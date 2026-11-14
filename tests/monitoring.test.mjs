import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,fakeResponse,mail} from './fixtures.mjs';
import {seal} from '../src/infra/crypto.ts';
import {issueSession,sessionCookie} from '../src/infra/security.ts';
import {handle} from '../src/web/handler.ts';
import {runCycle} from '../src/app/pipeline.ts';
import {DEFAULT_RULES,validateRules,triageEnvelope,evaluateScope,getRules,setRules,recordFiltered} from '../src/domain/monitoring.ts';

const sample={...DEFAULT_RULES,mode:'academic_extended',allowed_senders:['professor@gmail.com'],allowed_domains:['faculdade.edu.br'],blocked_senders:[],blocked_domains:[],sensitive_opt_in:false};

test('regras acadêmicas são default e não incluem pessoal silenciosamente',()=>{
 assert.equal(DEFAULT_RULES.mode,'academic_strict');
 const a=triageEnvelope({id:'1',sender:'editor@revista.com',subject:'Desconto exclusivo hoje',receivedAt:'2026-11-10'},DEFAULT_RULES);
 assert.equal(a.action,'skip');
 const b=triageEnvelope({id:'2',sender:'docente@gmail.com',subject:'Prova de cálculo em dezembro',receivedAt:'2026-11-10'},DEFAULT_RULES);
 assert.equal(b.action,'read');
 const c=triageEnvelope({id:'3',sender:'unknown@elsewhere.test',subject:'Olá',receivedAt:'2026-11-10'},DEFAULT_RULES);
 assert.equal(c.action,'uncertain');
});
test('domínios exigem fronteira de @; bloqueios têm prioridade; From não é prova de autenticidade',()=>{
 assert.equal(triageEnvelope({id:'1',sender:'Professor <docente@faculdade.edu.br>',subject:'Olá',receivedAt:''},sample).action,'read');
 assert.equal(triageEnvelope({id:'1',sender:'fake@faculdade.edu.br.attacker.test',subject:'Olá',receivedAt:''},sample).action,'uncertain');
 const rule={...sample,blocked_domains:['faculdade.edu.br']};
 assert.equal(triageEnvelope({id:'1',sender:'a@faculdade.edu.br',subject:'Prova 20/11/2026',receivedAt:''},rule).action,'skip');
 assert.equal(triageEnvelope({id:'1',sender:'bad@other.test\nBcc: hidden@test.com',subject:'Prova',receivedAt:''},sample).action,'uncertain');
});
test('validação rejeita combinações contraditórias e entradas maliciosas',()=>{
 assert.deepEqual(validateRules({...sample,allowed_senders:['PROFESSOR@gmail.com']} ).allowed_senders,['professor@gmail.com']);
 assert.throws(()=>validateRules({...sample,mode:'all'}),/INVALID_MONITORING_MODE/);
 assert.throws(()=>validateRules({...sample,allowed_domains:['faculdade.edu.br.attacker\ncc:test']}),/INVALID_MONITORING_ENTRY/);
 assert.throws(()=>validateRules({...sample,blocked_senders:['professor@gmail.com']}),/MONITORING_RULE_CONFLICT/);
 assert.throws(()=>validateRules({...sample,sensitive_opt_in:'true'}),/INVALID_SENSITIVE_OPT_IN/);
 assert.throws(()=>validateRules({...sample,allowed_senders:Array(31).fill('professor@gmail.com')}),/INVALID_MONITORING_LIST/);
});
test('perfil ampliado e pessoal identificam categorias adicionais sempre com revisão humana',()=>{
 const extended=evaluateScope(mail('Congresso de tecnologia','O congresso acontecerá em 20/11/2026 às 14h.'),sample);
 assert.equal(extended[0].state,'review');
 const personal=evaluateScope(mail('Consulta dentista','Sua consulta será 20/11/2026 às 14h.'),{...sample,mode:'personal',sensitive_opt_in:true});
 assert.equal(personal[0].kind,'event');assert.equal(personal[0].state,'review');
 const sensitive=triageEnvelope({id:'m',subject:'Sua fatura vence amanhã',sender:'banco@banco.com',receivedAt:''},{...sample,mode:'personal',sensitive_opt_in:false});
 assert.equal(sensitive.action,'skip');
});
test('persistência por conta é isolada e migração mantém contas antigas em estrito',async()=>{
 const {db,close}=setup();try{
  const now=Date.now();for(const id of ['a','b'])await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES(?,'gmail',?,'cipher',?,?)").bind(id,id+'@school.edu',now,now).run();
  assert.equal((await getRules(db,'a')).mode,'academic_strict');
  await setRules(db,'a',sample,now);assert.deepEqual(await getRules(db,'a'),sample);assert.equal((await getRules(db,'b')).mode,'academic_strict');
  await assert.rejects(setRules(db,'missing',sample,now),/MONITORING_CONNECTION_NOT_FOUND/);
 }finally{close();}
});
test('descarte é atômico, idempotente, sem reter assunto ou remetente',async()=>{
 const {db,close}=setup();try{
  const now=Date.now();await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('a','gmail','fake@school.edu','cipher',?,?)").bind(now,now).run();
  await db.prepare("INSERT INTO inbox(connection_id,remote_id,remote_revision,received_at) VALUES('a','x','0',?)").bind(now).run();
  const inbox=await db.prepare("SELECT id FROM inbox WHERE remote_id='x'").first();
  await recordFiltered(db,'a',inbox.id,'PROMOTIONAL_SUBJECT',now);
  await recordFiltered(db,'a',inbox.id,'PROMOTIONAL_SUBJECT',now);
  assert.equal((await db.prepare('SELECT count FROM monitoring_daily').first()).count,1);
  assert.equal((await db.prepare('SELECT state FROM inbox').first()).state,'done');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM academic_items').first()).n,0);
 }finally{close();}
});
async function insert(env,id,provider){const now=Date.now(),tokens={access_token:'test-access',refresh_token:'test-refresh',expires_at:now+3600000};const enc=await seal(env.APP_SECRET,JSON.stringify(tokens),`token:${id}:${provider}`);await env.DB.prepare('INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,provider,'test@school.edu',enc,now,now).run();}
test('Gmail: estrito descarta promoção por metadados sem buscar corpo completo',async()=>{
 const {env,db,close}=setup();try{
  await insert(env,'gtest','gmail');let metadata=0,full=0;
  const http={fetch:async(url)=>{
   const u=String(url);if(u.endsWith('/profile'))return fakeResponse({historyId:'101'});
   if(u.includes('/messages?'))return fakeResponse({messages:[{id:'message1'}]});
   if(u.includes('/messages/message1?')){if(u.includes('format=metadata'))metadata++;else full++;return fakeResponse({id:'message1',payload:{headers:[{name:'From',value:'ofertas@retail.test'},{name:'Subject',value:'Desconto exclusivo para você'}]}});}
   throw new Error('Unexpected '+u);
  }};
  await runCycle(env,http,Date.now());assert.equal(metadata,1);assert.equal(full,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM academic_items').first()).n,0);
  assert.equal((await db.prepare('SELECT reason FROM monitoring_skips').first()).reason,'PROMOTIONAL_SUBJECT');
 }finally{close();}
});
test('Outlook: triagem apenas com metadados evita baixar corpo de mensagem irrelevante',async()=>{
 const {env,db,close}=setup();try{
  await insert(env,'mtest','outlook');let metadata=0,full=0;
  const http={fetch:async(url)=>{
   const u=String(url);if(u.includes('messages/delta'))return fakeResponse({value:[{id:'message1'}],'@odata.deltaLink':'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=1'});
   if(u.includes('/me/messages/message1?')){if(u.includes('body,bodyPreview'))full++;else metadata++;return fakeResponse({id:'message1',subject:'Cupom de 50%',from:{emailAddress:{address:'vendas@empresa.test'}},receivedDateTime:'2026-11-10T12:00:00Z'});}
   throw new Error('Unexpected '+u);
  }};
  await runCycle(env,http,Date.now());assert.equal(metadata,1);assert.equal(full,0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM monitoring_skips').first()).n,1);
 }finally{close();}
});
test('API autenticada altera modo e reavalia mensagens com consentimento explícito',async()=>{
 const {env,db,close}=setup();try{
  await insert(env,'gtest','gmail');const now=Date.now();
  await db.prepare("INSERT INTO inbox(connection_id,remote_id,remote_revision,received_at) VALUES('gtest','x','0',?)").bind(now).run();
  const inbox=await db.prepare("SELECT id FROM inbox WHERE remote_id='x'").first();await recordFiltered(db,'gtest',inbox.id,'UNRECOGNIZED_SOURCE',now);
  const token=await issueSession(env);const headers={'Cookie':sessionCookie(token),'Origin':env.PUBLIC_ORIGIN,'Content-Type':'application/json'};
  const post=(path,obj)=>handle(new Request(env.PUBLIC_ORIGIN+path,{method:'POST',headers,body:JSON.stringify(obj)}),env);
  let resp=await post('/api/connections/gtest/monitoring',{...sample,mode:'personal'});assert.equal(resp.status,200);
  assert.equal((await getRules(db,'gtest')).mode,'personal');
  resp=await post('/api/connections/gtest/monitoring/rescan',{confirm:false});assert.equal(resp.status,400);
  resp=await post('/api/connections/gtest/monitoring/rescan',{confirm:true});assert.equal(resp.status,200);assert.equal((await resp.json()).requeued,1);
  assert.equal((await db.prepare("SELECT state FROM inbox WHERE remote_id='x'").first()).state,'queued');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM monitoring_skips').first()).n,0);
  resp=await handle(new Request(env.PUBLIC_ORIGIN+'/api/data',{headers:{Cookie:sessionCookie(token)}}),env);assert.equal(resp.status,200);
  const body=await resp.json();assert.equal(body.monitoring.gtest.mode,'personal');
 }finally{close();}
});

test('opt-out sensível não é contornado por remetente na allowlist',()=>{
 const rule={...sample,mode:'personal',allowed_senders:['banco@banco.com'],sensitive_opt_in:false};
 assert.equal(triageEnvelope({id:'a',sender:'banco@banco.com',subject:'Sua fatura vence dia 20',receivedAt:''},rule).action,'skip');
 assert.equal(triageEnvelope({id:'a',sender:'banco@banco.com',subject:'Sua fatura vence dia 20',receivedAt:''},{...rule,sensitive_opt_in:true}).action,'read');
});
