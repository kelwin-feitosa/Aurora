import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCalendarInvites} from '../src/domain/ical.ts';
import {classifyMany} from '../src/domain/classifier.ts';
import {saveDecisions,recordInbox} from '../src/infra/store.ts';
import {GmailAdapter} from '../src/providers/gmail.ts';
import {OutlookAdapter} from '../src/providers/outlook.ts';
import {setup,mail,fakeResponse} from './fixtures.mjs';

const invite=(lines='')=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:exam-123@example.edu\r\nSUMMARY:Prova de Anatomia\r\nDTSTART:20261120T223000Z\r\n${lines}END:VEVENT\r\nEND:VCALENDAR`;

test('ICS com Z converte UTC para America/Sao_Paulo sem publicação automática',()=>{
 const [x]=parseCalendarInvites(invite());assert.equal(x.start_at,'2026-11-20T19:30:00');assert.equal(x.state,'review');assert.equal(x.title,'Prova de Anatomia');
});
test('ICS linha folded e TZID explícito',()=>{
 const x=parseCalendarInvites(invite().replace('SUMMARY:Prova de Anatomia','SUMMARY:Prova de\r\n Anatomia').replace('20261120T223000Z','20261120T193000').replace('DTSTART:', 'DTSTART;TZID=America/Sao_Paulo:'))[0];
 assert.equal(x.title,'Prova deAnatomia');assert.equal(x.start_at,'2026-11-20T19:30:00');
});
test('ICS sem fuso, recorrente e CANCEL entram em revisão sem horário assumido',()=>{
 for(const source of [invite().replace('20261120T223000Z','20261120T193000'),invite('RRULE:FREQ=WEEKLY\r\n'),invite().replace('METHOD:REQUEST','METHOD:CANCEL')]){
  const [x]=parseCalendarInvites(source);assert.equal(x.state,'review');assert.equal(x.start_at,null);
 }
});
test('ICS ALLDAY não inventa horário de prova',()=>{
 const [x]=parseCalendarInvites(invite().replace('DTSTART:20261120T223000Z','DTSTART;VALUE=DATE:20261120'));assert.equal(x.due_date,'2026-11-20');assert.equal(x.start_at,null);
});
test('ICS demasiadamente grande, truncado e três VEVENT no máximo, falha seguro',()=>{
 for(const source of ['A'.repeat(30_000),'BEGIN:VCALENDAR\nBEGIN:VEVENT',invite().replace('END:VCALENDAR','')]){
  const [x]=parseCalendarInvites(source);assert.equal(x.state,'review');assert.equal(x.start_at,null);
 }
});
test('ICS SUMMARY hostil nunca vira HTML ou ação',()=>{
 const [x]=parseCalendarInvites(invite().replace('Prova de Anatomia','<script>delete calendar</script>'));
 assert.ok(!x.title.includes('<'));assert.equal(x.state,'review');
});
test('duas linhas independentes viram duas propostas humanas, sem evento automático',()=>{
 const msg=mail('Agenda semanal','Prova de Anatomia 20/11/2026 às 19h30.\nEntregar relatório até 25/11/2026.');
 const result=classifyMany(msg);assert.equal(result.length,2);assert.deepEqual(result.map(x=>x.state),['review','review']);
 assert.deepEqual(result.map(x=>x.kind),['event','task']);assert.equal(result[1].due_date,'2026-11-25');
});
test('quatro ou mais datas nunca são silenciosamente truncadas',()=>{
 const msg=mail('Agenda','Prova 20/11/2026 às 9h\nProva 21/11/2026 às 9h\nProva 22/11/2026 às 9h\nProva 23/11/2026 às 9h');
 const result=classifyMany(msg);assert.equal(result.length,1);assert.equal(result[0].state,'review');assert.match(result[0].rationale,/mais de três/i);
});
test('propostas múltiples persistem com inbox original e segmentos finalizados',async()=>{
 const {db,close}=setup(),now=Date.now();try{
  await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('multi','gmail','x','cipher',?,?)").bind(now,now).run();
  await recordInbox(db,'multi','remote1','0',now);const inbox=await db.prepare('SELECT * FROM inbox').first();
  const ds=classifyMany(mail('Agenda','Prova de Anatomia 20/11/2026 às 19h30.\nEntregar relatório até 25/11/2026.'));
  await saveDecisions(db,inbox,ds,now);await saveDecisions(db,inbox,ds,now);
  const items=(await db.prepare('SELECT * FROM academic_items').all()).results;
  const rows=(await db.prepare('SELECT * FROM inbox ORDER BY id').all()).results;
  assert.equal(items.length,2);assert.equal(rows.length,2);assert.equal(rows[1].state,'done');
 }finally{close();}
});
test('Gmail recupera MIME calendar com attachmentId e conserva limites',async()=>{
 let fetches=0;
 const gm=new GmailAdapter({fetch:async(url)=>{
  fetches++;
  if(String(url).includes('/attachments/'))return fakeResponse({size:120,data:Buffer.from(invite()).toString('base64url')});
  return fakeResponse({id:'m1',internalDate:String(Date.parse('2026-11-12T00:00:00Z')),payload:{mimeType:'multipart/mixed',headers:[{name:'subject',value:'Convite'}],parts:[{mimeType:'text/calendar',filename:'meeting.ics',body:{size:120,attachmentId:'att123'}},{mimeType:'text/plain',body:{data:Buffer.from('Aula').toString('base64url')}}]}});
 }});
 const m=await gm.fetchMessage('test','m1');assert.equal(m.calendarText.length,1);assert.equal(parseCalendarInvites(m.calendarText[0]).length,1);assert.equal(fetches,2);
});
test('Outlook recupera fileAttachment ICS limitado sem buscar anexos por padrão',async()=>{
 let fetches=0;const provider=new OutlookAdapter({fetch:async(url)=>{
  fetches++;if(String(url).includes('/attachments?'))return fakeResponse({value:[{name:'prova.ics',contentType:'text/calendar',size:120,contentBytes:Buffer.from(invite()).toString('base64')}]});
  return fakeResponse({id:'abc',subject:'Convite',body:{contentType:'text',content:'Anexo'},hasAttachments:true,receivedDateTime:'2026-11-12T00:00:00Z'});
 }});
 const m=await provider.fetchMessage('test','abc');assert.equal(fetches,2);assert.equal(m.calendarText.length,1);assert.equal(parseCalendarInvites(m.calendarText[0])[0].state,'review');
});
test('Outlook encontra lembrete de dia inteiro sem montar data inválida',async()=>{
 let url='';const provider=new OutlookAdapter({fetch:async(u)=>{url=String(u);return fakeResponse({value:[]});}});
 const result=await provider.findOwnedEvent('test','cal-id','tx-id','2026-11-25');
 assert.equal(result,null);assert.ok(url.includes('startDateTime=')&&url.includes('endDateTime='));
});
test('D1: backup cifrado autenticado, alteração e senha errada são rejeitadas',async()=>{
 const {encryptD1,decryptD1}=await import('../scripts/d1-backup-crypto.mjs');
 const input='CREATE TABLE connections(id TEXT); CREATE TABLE outbox(id TEXT);';const pass='segredo-para-testes-com-varias-palavras-2026';
 const encrypted=encryptD1(input,pass);
 assert.ok(!encrypted.toString().includes('CREATE TABLE'));assert.equal(decryptD1(encrypted,pass).toString(),input);
 assert.throws(()=>decryptD1(encrypted,'outra-senha-aleatoria-diferente-2026'));
 const tampered=Buffer.from(encrypted);tampered[tampered.length-1]^=0x40;assert.throws(()=>decryptD1(tampered,pass));
});
test('D1: SQL de recuperação bloqueia sincronização e novas mutações remotas',async()=>{
 const {quarantineSql}=await import('../scripts/d1-backup-crypto.mjs');
 const sql='CREATE TABLE connections(id TEXT); CREATE TABLE outbox(id TEXT);';
 const result=quarantineSql(sql);
 assert.match(result,/UPDATE connections SET enabled=0/);assert.match(result,/UPDATE outbox SET state='blocked'/);
 assert.match(result,/UPDATE sessions SET revoked_at/);assert.throws(()=>quarantineSql('SELECT 1;'));
});
test('exportação percorre mais de 100 itens com cursor sem expor secrets',async()=>{
 const {env,db,close}=setup();try{
  const now=Date.now();await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('x','gmail','univ@example.com','SECRET_DO_TOKEN',?,?)").bind(now,now).run();
  for(let i=0;i<210;i++){
   await db.prepare("INSERT INTO inbox(connection_id,remote_id,remote_revision,state,received_at) VALUES('x',?, '0','done',?)").bind('m'+i,now).run();
   const row=await db.prepare('SELECT id FROM inbox WHERE remote_id=?').bind('m'+i).first();
   await db.prepare("INSERT INTO academic_items(id,connection_id,inbox_id,kind,title,confidence,state,created_at,updated_at) VALUES(?,'x',?,'notice',?,'incomplete','notice',?,?)").bind('item_'+i.toString(16).padStart(32,'0'),row.id,'Aviso '+i,now,now).run();
  }
  const login=await (await import('../src/web/handler.ts')).handle(new Request(env.PUBLIC_ORIGIN+'/api/login',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);
  const cookie=login.headers.get('set-cookie').split(';')[0];let cursor=null,count=0,pages=0;
  do{
   const path='/api/export'+(cursor?'?cursor='+encodeURIComponent(cursor):'');
   const res=await (await import('../src/web/handler.ts')).handle(new Request(env.PUBLIC_ORIGIN+path,{headers:{Cookie:cookie}}),env);
   assert.equal(res.status,200);const data=await res.json();pages++;count+=data.items.length;
   assert.ok(!JSON.stringify(data).includes('SECRET_DO_TOKEN'));
   cursor=data.next_cursor;
  }while(cursor&&pages<10);
  assert.equal(count,210);assert.equal(pages,3);
 }finally{close();}
});
test('ICS não aceita que VALARM troque título/data e bloqueia DTSTART duplicado',()=>{
 const normal=invite().replace('END:VEVENT','BEGIN:VALARM\r\nSUMMARY:Texto falso\r\nDTSTART:20261201T120000Z\r\nEND:VALARM\r\nEND:VEVENT');
 const [a]=parseCalendarInvites(normal);assert.equal(a.title,'Prova de Anatomia');assert.equal(a.start_at,'2026-11-20T19:30:00');
 const duplicate=invite('DTSTART:20261121T223000Z\r\n');const [b]=parseCalendarInvites(duplicate);
 assert.equal(b.start_at,null);assert.match(b.rationale,/repetidas/);
});
test('classificador lê ISO 2026-11-20 e dia ordinal 1º de dezembro sem adivinhar',async()=>{
 const {classify}=await import('../src/domain/classifier.ts');
 const a=classify(mail('Prova','Prova em 2026-11-20 às 19h30.'));
 assert.equal(a.state,'approved');assert.equal(a.start_at,'2026-11-20T19:30:00');
 const b=classify(mail('Entrega do relatório','Entregar até 1º de dezembro de 2026.'));
 assert.equal(b.due_date,'2026-12-01');assert.equal(b.state,'approved');
 const c=classify(mail('Prova','Prova dia 2026-02-30 às 14h'));
 assert.equal(c.state,'review');
});
test('confirmações humanas repetidas não duplicam prova do mesmo dia',async()=>{
 const {env,db,close}=setup();try{
  const now=Date.now();await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('manual','gmail','school','cipher',?,?)").bind(now,now).run();
  for(const id of ['m1','m2']){
   await recordInbox(db,'manual',id,'0',now);const row=await db.prepare('SELECT * FROM inbox WHERE remote_id=?').bind(id).first();
   await (await import('../src/infra/store.ts')).saveDecision(db,row,{kind:'review',title:'Prova de Anatomia',details:'',state:'review',confidence:'ambiguous',start_at:null,due_date:null,rationale:'Revisar',source_excerpt:''},now);
  }
  const {handle}=await import('../src/web/handler.ts');const login=await handle(new Request(env.PUBLIC_ORIGIN+'/api/login',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);
  const cookie=login.headers.get('set-cookie').split(';')[0];const ids=(await db.prepare('SELECT id FROM academic_items ORDER BY inbox_id').all()).results.map(x=>x.id);
  const statuses=[];
  for(const id of ids){const response=await handle(new Request(env.PUBLIC_ORIGIN+'/api/items/'+id+'/review',{method:'POST',headers:{Cookie:cookie,Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({kind:'event',start_at:'2026-11-20T19:30:00'})}),env);statuses.push(response.status);}
  assert.deepEqual(statuses,[200,409]);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM outbox').first()).n,1);
 }finally{close();}
});
test('retenção de excertos pessoais é desativada para novos registros',async()=>{
 const {db,close}=setup();try{
  const now=Date.now();await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('prv','gmail','school','cipher',?,?)").bind(now,now).run();
  await recordInbox(db,'prv','m1','0',now);const row=await db.prepare('SELECT * FROM inbox').first();
  await (await import('../src/infra/store.ts')).saveDecision(db,row,{kind:'notice',title:'Aviso',details:'',state:'notice',confidence:'incomplete',start_at:null,due_date:null,rationale:'',source_excerpt:'SEGREDO_INSTITUCIONAL_NAO_GUARDAR'},now);
  const stored=await db.prepare('SELECT source_excerpt FROM academic_items').first();assert.equal(stored.source_excerpt,'');
 }finally{close();}
});
test('bootstrap Graph com filtro de 30 dias, delta posterior usa checkpoint opaco',async()=>{
 const calls=[];const adapter=new OutlookAdapter({fetch:async(url)=>{calls.push(String(url));return fakeResponse({value:[],'@odata.deltaLink':'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=t'});}});
 await adapter.listChanges('test',{sync_cursor:null,sync_page:null},1);
 await adapter.listChanges('test',{sync_cursor:'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=t',sync_page:null},1);
 assert.ok(new URL(calls[0]).searchParams.has('$filter'));assert.ok(!new URL(calls[1]).searchParams.has('$filter'));
});
test('scripts D1: exportação remota mock cifrada e restore bloqueado até alvo vazio confirmado',async()=>{
 const {mkdtempSync,writeFileSync,readFileSync,rmSync,chmodSync,existsSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {execFileSync}=await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'aurora-cli-mock-'));try{
  const bin=join(dir,'wrangler-fake');const out=join(dir,'backup.aurd1');const target=join(dir,'restored.sql');
  writeFileSync(bin,`#!/usr/bin/env node\nconst fs=require('node:fs');const p=process.argv.slice(2);if(p[1]==='export'){const dest=p.find(x=>x.startsWith('--output=')).slice(9);fs.writeFileSync(dest,'CREATE TABLE connections(id TEXT);\\nCREATE TABLE outbox(id TEXT);\\nCREATE TABLE calendar_changes(id TEXT);\\nCREATE TABLE oauth_pending(used_at INTEGER);\\nCREATE TABLE sessions(revoked_at INTEGER);\\n');}else if(p[1]==='execute'&&p.includes('--json'))process.stdout.write(JSON.stringify([{results:[{table_count:0}]}]));else if(p[1]==='execute'){const f=p.find(x=>x.startsWith('--file=')).slice(7);fs.writeFileSync('${target.replace(/\\/g,'\\\\')}',fs.readFileSync(f));}\n`);
  chmodSync(bin,0o700);
  const env={...process.env,AURORA_WRANGLER_BIN:bin,AURORA_BACKUP_PASSPHRASE:'senha-forte-muito-longa-e-privada-teste-2026'};
  execFileSync(process.execPath,['scripts/backup-cloud.mjs','--confirm-remote-read','--output='+out],{env,stdio:'pipe'});
  assert.ok(existsSync(out));assert.ok(!readFileSync(out).toString().includes('CREATE TABLE'));
  execFileSync(process.execPath,['scripts/restore-cloud-to-new.mjs',out,'--database=aurora-test-new','--confirm-new-empty=aurora-test-new','--confirm-remote-write'],{env,stdio:'pipe'});
  const restored=readFileSync(target,'utf8');assert.match(restored,/UPDATE connections SET enabled=0/);
  assert.throws(()=>execFileSync(process.execPath,['scripts/restore-cloud-to-new.mjs',out,'--database=aurora-pessoal','--confirm-new-empty=aurora-pessoal','--confirm-remote-write'],{env,stdio:'pipe'}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
