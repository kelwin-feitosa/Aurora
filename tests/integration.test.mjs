import test from 'node:test';import assert from 'node:assert/strict';
import {setup,fakeResponse} from './fixtures.mjs';
import {seal} from '../src/infra/crypto.ts';
import {runCycle} from '../src/app/pipeline.ts';
import {handle} from '../src/web/handler.ts';
import {beginOauth,finishOauth} from '../src/providers/oauth.ts';

const msgText='A prova de Anatomia está marcada para 18/11/2026 às 15h. Favor confirmar com o professor.';
function base64url(s){return Buffer.from(s).toString('base64url');}
async function insertConnection(env,p,id){const now=Date.now(),tokens={access_token:'faketoken',refresh_token:'fake-refresh',expires_at:Date.now()+3600_000};const enc=await seal(env.APP_SECRET,JSON.stringify(tokens),`token:${id}:${p}`);await env.DB.prepare('INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,p,'fake@school.edu',enc,now,now).run();}
function googleMock({lostResponse=false}={}){
 let posts=0,events=new Map(),calls=[];
 return {get posts(){return posts},get calls(){return calls},get events(){return events},async fetch(url,options={}){
  const u=String(url);calls.push([u,options.method||'GET']);
  if(u.endsWith('/profile'))return fakeResponse({emailAddress:'student@ceub.edu.br',historyId:'990'});
  if(u.includes('/messages?'))return fakeResponse({messages:[{id:'x1'}]});
  if(u.includes('/history?'))return fakeResponse({historyId:'991',history:[]});
  if(u.includes('/messages/x1?'))return fakeResponse({id:'x1',historyId:'990',payload:{headers:[{name:'Subject',value:'Prova de Anatomia'},{name:'From',value:'Professor <professor@school.edu>'}],mimeType:'text/plain',body:{data:base64url(msgText)}},internalDate:String(Date.parse('2026-11-10T12:00:00.000Z'))});
  if(u.includes('/calendarList'))return fakeResponse({items:[{id:'cal1',summary:'Aurora • g1'}]});
  if(u.includes('/events/')&&(!options.method||options.method==='GET')){const id=u.split('/events/')[1];return events.has(id)?fakeResponse(events.get(id)):fakeResponse({error:'not found'},404);}
  if(u.includes('/events/')&&options.method==='PATCH'){const id=u.split('/events/')[1],evt=events.get(id);if(!evt)return fakeResponse({},404);const patch=JSON.parse(options.body);events.set(id,{...evt,summary:patch.summary,start:patch.start});return fakeResponse(events.get(id));}
  if(u.includes('/events/')&&options.method==='DELETE'){events.delete(u.split('/events/')[1]);return new Response(null,{status:204});}
  if(u.endsWith('/events')&&options.method==='POST'){
    posts++;const parsed=JSON.parse(options.body),evt={id:parsed.id,summary:parsed.summary,start:parsed.start,extendedProperties:parsed.extendedProperties};events.set(evt.id,evt);
    if(lostResponse&&posts===1)throw Error('Simulated network cut after remote commit');
    return fakeResponse(evt,201);
  }
  throw new Error('Unexpected Google mock URL '+u);
 }};
}
function microsoftMock(){
 let posts=0,events=new Map(),calls=[];
 return {get posts(){return posts},get calls(){return calls},get events(){return events},async fetch(url,options={}){
 const u=String(url);calls.push([u,options.method||'GET']);
 if(u.includes('/messages/delta'))return fakeResponse({value:posts?[]:[{id:'ms1'}],'@odata.deltaLink':'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=12'});
 if(u.includes('/me/messages/ms1?'))return fakeResponse({id:'ms1',subject:'Prova de Anatomia',body:{contentType:'text',content:msgText},from:{emailAddress:{address:'professor@school.edu'}},receivedDateTime:'2026-11-10T12:00:00Z'});
 if(u.includes('/me/calendars?'))return fakeResponse({value:[{id:'cal-ms',name:'Aurora • o1'}]});
 if(u.includes('/calendarView?'))return fakeResponse({value:[...events.values()]});
 if(u.includes('/events/')&&(!options.method||options.method==='GET')){const id=u.split('/events/')[1].split('?')[0];return events.has(id)?fakeResponse(events.get(id)):fakeResponse({},404);}
 if(u.includes('/events/')&&options.method==='PATCH'){const id=u.split('/events/')[1].split('?')[0];const e=events.get(id);if(!e)return fakeResponse({},404);const p=JSON.parse(options.body);events.set(id,{...e,subject:p.subject,start:p.start,isAllDay:p.isAllDay});return fakeResponse(events.get(id));}
 if(u.includes('/events/')&&options.method==='DELETE'){events.delete(u.split('/events/')[1].split('?')[0]);return new Response(null,{status:204});}
 if(u.endsWith('/events')&&options.method==='POST'){
  posts++;const parsed=JSON.parse(options.body);const evt={id:'graph-'+posts,transactionId:parsed.transactionId,subject:parsed.subject,start:parsed.start,isAllDay:parsed.isAllDay};events.set(evt.id,evt);return fakeResponse(evt,201);
 }
 throw new Error('Unexpected Graph mock URL '+u);
 }};
}


/** A provider's From header is NOT an authentication attestation. All fixture
 * calendar writes must explicitly simulate the real authenticated review API. */
async function synchronizeThenConfirm(env,http,now){
 await runCycle(env,http,now);
 const rows=(await env.DB.prepare("SELECT id,kind,start_at,due_date FROM academic_items WHERE state='review'").all()).results;
 assert.equal(rows.length,1,'Expected one reviewable message before explicit consent');
 const item=rows[0];
 const {issueSession}=await import('../src/infra/security.ts');
 const token=await issueSession(env);
 const response=await handle(new Request(env.PUBLIC_ORIGIN+'/api/items/'+item.id+'/review',{
  method:'POST',headers:{Cookie:'aurora_session='+token,Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'},
  body:JSON.stringify(item.kind==='task'?{kind:'task',due_date:item.due_date}:{kind:'event',start_at:item.start_at})
 }),env);
 assert.equal(response.status,200,await response.text());
 await runCycle(env,http,now+60000);
}

test('Gmail: sincronização → classificação → outbox → calendário, sem duplicatas',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'gmail','g1');const http=googleMock();const now=Date.now();await synchronizeThenConfirm(env,http,now);
 const items=(await db.prepare('SELECT * FROM academic_items').all()).results;assert.equal(items.length,1);assert.equal(items[0].state,'synced');
 assert.equal((await db.prepare("SELECT state FROM outbox").first()).state,'committed');assert.equal(http.posts,1);
 await runCycle(env,http,now+120000);assert.equal(http.posts,1);close();
});
test('Graph: sincronização e criação com transactionId, sem POST duplicado',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'outlook','o1');const http=microsoftMock(),now=Date.now();await synchronizeThenConfirm(env,http,now);
 assert.equal(http.posts,1);assert.equal((await db.prepare('SELECT state FROM academic_items').first()).state,'synced');
 await runCycle(env,http,now+120000);assert.equal(http.posts,1);close();
});
test('perda de resposta após POST: estado UNKNOWN, reconciliação GET, sem segundo POST',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'gmail','g1');const http=googleMock({lostResponse:true}),now=Date.now();
 await synchronizeThenConfirm(env,http,now);assert.equal(http.posts,1);
 assert.equal((await db.prepare('SELECT state FROM outbox').first()).state,'unknown');
 await runCycle(env,http,now+180000);assert.equal(http.posts,1);
 assert.equal((await db.prepare('SELECT state FROM outbox').first()).state,'committed');close();
});
test('checkpoint só avança se gravação atômica puder ocorrer',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'gmail','g1');
 const originalBatch=db.batch;db.batch=async()=>{throw new Error('Crash inside transaction');};
 await runCycle(env,googleMock());assert.equal((await db.prepare('SELECT sync_cursor FROM connections').first()).sync_cursor,null);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM inbox').first()).n,0);db.batch=originalBatch;close();
});
test('rotas privadas, CSRF, autenticação e sanitização do export',async()=>{
 const {db,env,close}=setup();
 let response=await handle(new Request(env.PUBLIC_ORIGIN+'/api/data'),env);assert.equal(response.status,401);
 response=await handle(new Request(env.PUBLIC_ORIGIN+'/api/login',{method:'POST',headers:{Origin:'https://attacker.test','Content-Type':'application/json'},body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);assert.equal(response.status,403);
 response=await handle(new Request(env.PUBLIC_ORIGIN+'/api/login',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie').split(';')[0];assert.match(response.headers.get('set-cookie'),/HttpOnly/);
 response=await handle(new Request(env.PUBLIC_ORIGIN+'/api/data',{headers:{Cookie:cookie}}),env);assert.equal(response.status,200);
 const exp=await handle(new Request(env.PUBLIC_ORIGIN+'/api/export',{headers:{Cookie:cookie}}),env);const payload=JSON.stringify(await exp.json());assert.ok(!payload.includes(env.INSTALLATION_PASSPHRASE));assert.ok(!payload.includes(env.APP_SECRET));
 response=await handle(new Request(env.PUBLIC_ORIGIN+'/api/sync',{method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.test'}}),env);assert.equal(response.status,403);
 close();
});
test('OAuth: credencial cifrada, state one-time e PKCE',async()=>{
 const {db,env,close}=setup();const {issueSession,currentSessionHash}=await import('../src/infra/security.ts');const cookie='aurora_session='+await issueSession(env);const sessionHash=await currentSessionHash(env,new Request(env.PUBLIC_ORIGIN,{headers:{Cookie:cookie}}));const url=new URL(await beginOauth(env,'gmail',sessionHash));
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('state'));assert.ok(url.searchParams.get('scope').includes('gmail.readonly'));
 const state=url.searchParams.get('state');const fake={fetch:async(u)=>{
  if(String(u).includes('token'))return fakeResponse({access_token:'access-confidential',refresh_token:'refresh-confidential',expires_in:3600});
  return fakeResponse({emailAddress:'me@ceub.edu.br'});
 }};
 await finishOauth(env,'gmail',state,'a-test-code',sessionHash,fake);
 const c=await db.prepare('SELECT * FROM connections').first();assert.equal(c.provider,'gmail');assert.ok(!c.token_ciphertext.includes('refresh-confidential'));await assert.rejects(finishOauth(env,'gmail',state,'again',sessionHash,fake));close();
});
test('tarefas com prazo viram lembretes de dia inteiro, não inventam horário',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'gmail','g1');const http=googleMock();
 const message={id:'xx',revision:'0',subject:'Entrega do relatório',body:'Enviar o relatório até 21/11/2026',receivedAt:'2026-11-10T10:00:00Z'};
 const {classify}=await import('../src/domain/classifier.ts');const {recordInbox,saveDecision,queueEvent}=await import('../src/infra/store.ts');
 await recordInbox(db,'g1',message.id,'0',Date.now());const inbox=await db.prepare('SELECT * FROM inbox').first();const item=await saveDecision(db,inbox,classify(message),Date.now());
 assert.equal(item.kind,'task');await queueEvent(db,item,Date.now());
 await runCycle(env,http,Date.now());
 assert.equal((await db.prepare('SELECT state FROM outbox').first()).state,'committed');close();
});
test('Graph resultado remoto desconhecido bloqueia novo POST automático quando não encontrado',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'outlook','o1');const fake=microsoftMock();let calls=0;
 const mock={get posts(){return calls},async fetch(url,opts={}){
  if(String(url).endsWith('/events')&&opts.method==='POST'){calls++;throw Error('NETWORK_FAILED_AFTER_REMOTE_COMMIT_UNKNOWN');}
  return fake.fetch(url,opts);
 }};
 const now=Date.now();await synchronizeThenConfirm(env,mock,now);assert.equal(calls,1);assert.equal((await db.prepare('SELECT state FROM outbox').first()).state,'unknown');
 await runCycle(env,mock,now+180000);assert.equal(calls,1);assert.equal((await db.prepare('SELECT state FROM outbox').first()).state,'blocked');close();
});
test('alteração de preferência só aceita valores permitidos; CSRF continua obrigatório',async()=>{
 const {db,env,close}=setup();const r=await handle(new Request(env.PUBLIC_ORIGIN+'/api/login',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);const cookie=r.headers.get('set-cookie').split(';')[0];
 const wrong=await handle(new Request(env.PUBLIC_ORIGIN+'/api/preferences',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({event_reminder_minutes:-1,task_reminder_minutes:1440})}),env);assert.equal(wrong.status,400);
 const right=await handle(new Request(env.PUBLIC_ORIGIN+'/api/preferences',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({event_reminder_minutes:60,task_reminder_minutes:2880})}),env);assert.equal(right.status,200);assert.equal((await db.prepare('SELECT event_reminder_minutes FROM preferences').first()).event_reminder_minutes,60);close();
});

test('logout revoga sessão no banco inclusive se cookie tiver sido copiado',async()=>{
 const {env,db,close}=setup();const h={Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'};
 const login=await handle(new Request(env.PUBLIC_ORIGIN+'/api/login',{method:'POST',headers:h,body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);
 assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await handle(new Request(env.PUBLIC_ORIGIN+'/api/data',{headers:{Cookie:cookie}}),env)).status,200);
 const logout=await handle(new Request(env.PUBLIC_ORIGIN+'/api/logout',{method:'POST',headers:{...h,Cookie:cookie},body:'{}'}),env);
 assert.equal(logout.status,200);
 assert.equal((await handle(new Request(env.PUBLIC_ORIGIN+'/api/data',{headers:{Cookie:cookie}}),env)).status,401);
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE revoked_at IS NOT NULL').first()).count,1);
 close();
});

test('vinculação OAuth não permite completar state originado por outra sessão',async()=>{
 const {db,env,close}=setup();const {issueSession,currentSessionHash}=await import('../src/infra/security.ts');
 const a='aurora_session='+await issueSession(env),b='aurora_session='+await issueSession(env);
 const sa=await currentSessionHash(env,new Request(env.PUBLIC_ORIGIN,{headers:{Cookie:a}}));
 const sb=await currentSessionHash(env,new Request(env.PUBLIC_ORIGIN,{headers:{Cookie:b}}));
 const state=new URL(await beginOauth(env,'gmail',sa)).searchParams.get('state');
 const fake={fetch:async(u)=>String(u).includes('token')?fakeResponse({access_token:'a',refresh_token:'r',expires_in:3600}):fakeResponse({emailAddress:'user@school.edu'})};
 await assert.rejects(finishOauth(env,'gmail',state,'code',sb,fake),/OAUTH_STATE_INVALID_OR_EXPIRED/);
 assert.equal((await db.prepare('SELECT used_at FROM oauth_pending WHERE session_hash=?').bind(sa).first()).used_at,null);
 await finishOauth(env,'gmail',state,'code',sa,fake);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM connections').first()).n,1);close();
});

test('Gmail: correção e cancelamento remotos manuais preservam propriedade do evento',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'gmail','g1');const http=googleMock(),now=Date.now();
 const {queueCalendarChange,deliverCalendarChange}=await import('../src/app/pipeline.ts');
 await synchronizeThenConfirm(env,http,now);assert.equal(http.posts,1);
 const item=(await db.prepare('SELECT * FROM academic_items').first());
 const id=await queueCalendarChange(env,item.id,{action:'update',start_at:'2026-11-20T15:00:00'});
 let change=await db.prepare('SELECT * FROM calendar_changes WHERE id=?').bind(id).first();
 await deliverCalendarChange(env,change,http,now+60000);
 assert.equal((await db.prepare('SELECT state FROM calendar_changes WHERE id=?').bind(id).first()).state,'committed');
 assert.equal((await db.prepare('SELECT start_at FROM academic_items WHERE id=?').bind(item.id).first()).start_at,'2026-11-20T15:00:00');
 const calId=(await db.prepare('SELECT calendar_id FROM connections').first()).calendar_id;
 assert.equal([...http.events.values()][0].start.dateTime,'2026-11-20T15:00:00-03:00');
 const id2=await queueCalendarChange(env,item.id,{action:'cancel'});
 change=await db.prepare('SELECT * FROM calendar_changes WHERE id=?').bind(id2).first();await deliverCalendarChange(env,change,http,now+120000);
 assert.equal((await db.prepare('SELECT state FROM academic_items WHERE id=?').bind(item.id).first()).state,'ignored');
 assert.equal(http.events.size,0);assert.equal(calId,'cal1');close();
});

test('Outlook: correção com Graph PATCH só alcança transactionId esperado',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'outlook','o1');const http=microsoftMock(),now=Date.now();
 const {queueCalendarChange,deliverCalendarChange}=await import('../src/app/pipeline.ts');
 await synchronizeThenConfirm(env,http,now);const item=await db.prepare('SELECT * FROM academic_items').first();
 const id=await queueCalendarChange(env,item.id,{action:'update',start_at:'2026-11-20T16:00:00'});
 const change=await db.prepare('SELECT * FROM calendar_changes WHERE id=?').bind(id).first();
 await deliverCalendarChange(env,change,http,now+80000);
 assert.equal((await db.prepare('SELECT state FROM calendar_changes WHERE id=?').bind(id).first()).state,'committed');
 assert.equal([...http.events.values()][0].start.dateTime,'2026-11-20T16:00:00');close();
});

test('propriedade remota inválida bloqueia operação destrutiva',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'gmail','g1');const http=googleMock(),now=Date.now();
 const {queueCalendarChange,deliverCalendarChange}=await import('../src/app/pipeline.ts');
 await synchronizeThenConfirm(env,http,now);const item=await db.prepare('SELECT * FROM academic_items').first();
 const id=await queueCalendarChange(env,item.id,{action:'cancel'});
 const e=[...http.events.values()][0];e.extendedProperties.private.source_id='tampered';
 const change=await db.prepare('SELECT * FROM calendar_changes WHERE id=?').bind(id).first();await deliverCalendarChange(env,change,http,now+70000);
 assert.equal((await db.prepare('SELECT state FROM calendar_changes WHERE id=?').bind(id).first()).state,'blocked');
 assert.equal(http.events.size,1);assert.equal((await db.prepare('SELECT state FROM academic_items').first()).state,'synced');close();
});

test('budget de chamadas registra tentativas e impede ultrapassar limite por execução',async()=>{
 const {db,env,close}=setup();const {meteredProviderHTTP}=await import('../src/app/pipeline.ts');let n=0;
 const metered=meteredProviderHTTP(env,{fetch:async()=>{n++;throw new Error('NET');}},2);
 await assert.rejects(metered.fetch('https://www.googleapis.com'));await assert.rejects(metered.fetch('https://www.googleapis.com'));
 await assert.rejects(metered.fetch('https://www.googleapis.com'),/CYCLE_PROVIDER_CALL_CAP/);
 assert.equal(n,2);const usage=await db.prepare('SELECT provider_calls FROM usage_daily').first();assert.equal(usage.provider_calls,2);close();
});

test('PATCH efetuado remotamente com resposta perdida é reconciliado sem novo PATCH',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'gmail','g1');const fake=googleMock();const now=Date.now();
 const {queueCalendarChange,deliverCalendarChange}=await import('../src/app/pipeline.ts');await synchronizeThenConfirm(env,fake,now);
 const item=await db.prepare('SELECT * FROM academic_items').first(),id=await queueCalendarChange(env,item.id,{action:'update',start_at:'2026-11-21T17:00:00'});
 let patches=0;const network={fetch:async(u,o={})=>{const r=await fake.fetch(u,o);if(o.method==='PATCH'&&patches++===0)throw new Error('POST_RESPONSE_LOST');return r;}};
 let change=await db.prepare('SELECT * FROM calendar_changes WHERE id=?').bind(id).first();await deliverCalendarChange(env,change,network,now+50000);
 assert.equal((await db.prepare('SELECT state FROM calendar_changes WHERE id=?').bind(id).first()).state,'unknown');
 change=await db.prepare('SELECT * FROM calendar_changes WHERE id=?').bind(id).first();await deliverCalendarChange(env,change,network,now+200000);
 assert.equal(patches,1);assert.equal((await db.prepare('SELECT state FROM calendar_changes WHERE id=?').bind(id).first()).state,'committed');close();
});

test('mensagem irrecuperável estaciona após cinco tentativas sem loop de falhas',async()=>{
 const {db,env,close}=setup();await insertConnection(env,'gmail','g1');const mock=googleMock();let failures=0;
 const http={fetch:async(url,opt)=>{if(String(url).includes('/messages/x1?')){failures++;return fakeResponse({},500);}return mock.fetch(url,opt);}};
 const t=Date.now();for(let i=0;i<5;i++)await runCycle(env,http,t+i*3600000);
 const row=await db.prepare('SELECT * FROM inbox').first();assert.equal(row.attempts,5);assert.equal(row.last_error,'MAIL_STUCK_MANUAL_RETRY_REQUIRED');
 await runCycle(env,http,t+6*3600000);assert.equal(failures,5);
 const retry=await db.prepare('UPDATE inbox SET attempts=0,next_attempt_at=0,last_error=NULL WHERE id=? AND attempts>=5').bind(row.id).run();assert.equal(retry.meta.changes,1);close();
});

test('POST de sincronização manual tem intervalo de segurança de 60 segundos',async()=>{
 const {env,close}=setup();const headers={Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'};
 const login=await handle(new Request(env.PUBLIC_ORIGIN+'/api/login',{method:'POST',headers,body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);
 const Cookie=login.headers.get('set-cookie').split(';')[0];
 const first=await handle(new Request(env.PUBLIC_ORIGIN+'/api/sync',{method:'POST',headers:{...headers,Cookie},body:'{}'}),env);
 const second=await handle(new Request(env.PUBLIC_ORIGIN+'/api/sync',{method:'POST',headers:{...headers,Cookie},body:'{}'}),env);
 assert.equal(first.status,200);assert.equal(second.status,429);assert.equal((await second.json()).error,'MANUAL_SYNC_COOLDOWN');close();
});

test('API provider rejeita host externo, URL com credenciais e resposta grande',async()=>{
 const {apiJson}=await import('../src/providers/http.ts');
 let outbound=0;const mock={fetch:async()=>{outbound++;return fakeResponse({content:'x'.repeat(600000)});}};
 await assert.rejects(apiJson(mock,'https://evil.example/messages','fake'),/BLOCKED_EXTERNAL_URL/);
 await assert.rejects(apiJson(mock,'https://login:pass@gmail.googleapis.com/messages','fake'),/BLOCKED_EXTERNAL_URL/);
 assert.equal(outbound,0);
 await assert.rejects(apiJson(mock,'https://gmail.googleapis.com/gmail/v1/users/me/profile','fake'),/PROVIDER_RESPONSE_TOO_LARGE/);
 assert.equal(outbound,1);
});

test('migração incremental 1.1 → 1.2 preserva dados e cria tabelas novas',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {DatabaseSync}=await import('node:sqlite');const {readFileSync,readdirSync}=await import('node:fs');
 const {SQLiteD1:NewDB}=await import('../scripts/sqlite-adapter.mjs');
 const folder=mkdtempSync(join(tmpdir(),'aurora-migration-')),path=join(folder,'migrated.sqlite');
 try{
  // Recreate the 1.1 schema from immutable 0001-0005 migration files included in this package.
  // Their SHA-256 was confirmed identical to the Aurora 1.1 source archive.
  const old=new DatabaseSync(path);
  old.exec('PRAGMA foreign_keys=ON; CREATE TABLE _local_migrations(file TEXT PRIMARY KEY)');
  const base=new URL('../migrations/',import.meta.url);
  for(const file of readdirSync(base).filter(x=>/^000[1-5]_.*\.sql$/.test(x)).sort()){
   old.exec(readFileSync(new URL(file,base),'utf8'));old.prepare('INSERT INTO _local_migrations(file) VALUES(?)').run(file);
  }
  const t=Date.now();old.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('legacy','gmail','old@example.test','sealed',?,?)").run(t,t);old.close();
  const db=new NewDB(path);
  assert.equal((await db.prepare('SELECT account_hint FROM connections WHERE id=?').bind('legacy').first()).account_hint,'old@example.test');
  const applied=(await db.prepare('SELECT file FROM _local_migrations').all()).results.map(x=>x.file);
  assert.ok(applied.includes('0006_sessions_oauth_binding.sql'));
  assert.ok(applied.includes('0009_runtime_guard.sql'));
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='calendar_changes'").first()).n,1);
  db.close();
 }finally{rmSync(folder,{recursive:true,force:true});}
});
