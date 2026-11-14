import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {handle} from '../src/web/handler.ts';
import {setup} from './fixtures.mjs';
import {issueSession} from '../src/infra/security.ts';
import {recordInbox,saveDecision} from '../src/infra/store.ts';
import {SERVICE_WORKER,PWA_MANIFEST,HTML} from '../src/web/ui.ts';

const origin='https://aurora.example.test';
const get=(route)=>new Request(origin+route);
test('PWA: manifesto instalável e PNGs servidos corretamente',async()=>{
 const {env,close}=setup();try{
  const r=await handle(get('/assets/manifest.webmanifest'),env);
  assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/manifest\+json/);
  const data=await r.json();assert.equal(data.scope,'/');assert.equal(data.display,'standalone');assert.equal(data.lang,'pt-BR');
  assert.ok(data.icons.some(i=>i.sizes==='192x192'));
  assert.ok(data.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
  for(const icon of data.icons){const img=await handle(get(icon.src),env);assert.equal(img.status,200);assert.equal(img.headers.get('content-type'),'image/png');const bytes=new Uint8Array(await img.arrayBuffer());assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);}
 }finally{close()}
});

test('PWA: público não exige sessão, APIs privadas não vazam, SW não permite inline',async()=>{
 const {env,close}=setup();try{
  for(const [route,type] of [['/','text/html'],['/sw.js','application/javascript'],['/instalar','text/html'],['/demonstracao','text/html'],['/offline.html','text/html'],['/assets/install.js','application/javascript']]){
    const r=await handle(get(route),env);assert.equal(r.status,200,route);assert.ok(r.headers.get('content-type')?.includes(type));
    assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);
  }
  const privateResponse=await handle(get('/api/diagnostics'),env);assert.equal(privateResponse.status,401);
  const sw=await handle(get('/sw.js'),env);assert.equal(sw.headers.get('cache-control'),'no-cache, no-store');
  assert.match(HTML,/rel="manifest"/);
  assert.ok(!HTML.includes('local-test-not-for-production'));
 }finally{close()}
});

test('SW: não intercepta/cacheia rotas de dados pessoais, OAuth e HTML privado',async()=>{
 const listeners={};let opened=0,putCount=0;
 const cache={match:async()=>null,put:async()=>{putCount++},addAll:async()=>{}};
 const caches={open:async()=>{opened++;return cache},keys:async()=>[]};
 const context={self:{location:{origin},addEventListener:(name,fn)=>{listeners[name]=fn},clients:{claim:async()=>{}},skipWaiting:async()=>{}},URL,Response,Request,caches,fetch:async()=>{const r=new Response('OK');Object.defineProperty(r,'type',{value:'basic'});return r;},console};
 vm.runInNewContext(SERVICE_WORKER,context);
 assert.equal(typeof listeners.fetch,'function');
 for(const path of ['/api/data','/api/oauth/start','/instalar','/','/api/export']){
   let responded=false;
   listeners.fetch({request:new Request(origin+path),respondWith:()=>{responded=true}});
   assert.equal(responded,false,`${path} jamais deve entrar no cache`);
 }
 assert.equal(opened,0);assert.equal(putCount,0);
 let promise=null;
 listeners.fetch({request:new Request(origin+'/assets/aurora.css'),respondWith:(p)=>{promise=p;}});
 assert.ok(promise);await promise;assert.equal(putCount,1);
});

test('Revisão: horário local 23:30 válido sem erro de mudança de dia UTC',async()=>{
 const {db,env,close}=setup();try{
  const now=Date.now();
  await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('late','gmail','student@example.test','cipher',?,?)").bind(now,now).run();
  await recordInbox(db,'late','msg1','0',now);
  const row=await db.prepare('SELECT * FROM inbox WHERE connection_id=?').bind('late').first();
  const item=await saveDecision(db,row,{kind:'review',title:'Prova noturna',details:'',start_at:null,due_date:null,confidence:'incomplete',source_excerpt:'',rationale:'Revisar',state:'review'},now);
  const token=await issueSession(env),cookie=`aurora_session=${token}`;
  const r=await handle(new Request(origin+'/api/items/'+item.id+'/review',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({kind:'event',start_at:'2026-11-20T23:30:00'})}),env);
  assert.equal(r.status,200,await r.text());
  const updated=await db.prepare('SELECT start_at,state FROM academic_items WHERE id=?').bind(item.id).first();
  assert.equal(updated.start_at,'2026-11-20T23:30:00');assert.equal(updated.state,'approved');
 }finally{close()}
});

test('Diagnóstico só autenticado e não revela credenciais',async()=>{
 const {env,close}=setup();try{
  const token=await issueSession(env);
  const r=await handle(new Request(origin+'/api/diagnostics',{headers:{cookie:`aurora_session=${token}`}}),env);
  assert.equal(r.status,200);const data=await r.json();assert.ok(data.database);assert.equal(data.connections,0);assert.equal(data.providers.gmail,true);assert.ok(!JSON.stringify(data).includes('test-secret'));assert.match(data.cron_status,/Nenhuma execução/);
 }finally{close()}
});

test('Comunicado de remarcação tem decisão de revisão e nunca cria novo evento',async()=>{
 const {classify}=await import('../src/domain/classifier.ts');
 const message={id:'remarca1',revision:'0',subject:'Prova de Anatomia remarcada',body:'A avaliação foi remarcada para 25/11/2026 às 10h.',receivedAt:'2026-11-12T10:00:00Z'};
 const result=classify(message);assert.equal(result.kind,'review');assert.equal(result.state,'review');assert.match(result.rationale,/Comunicado menciona alteração/);
});

test('Revisão manual pode ser ignorada com confirmação; não ignora evento já sincronizado',async()=>{
 const {db,env,close}=setup();try{
  const t=Date.now();await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('c','gmail','fake@example.test','cipher',?,?)").bind(t,t).run();
  await recordInbox(db,'c','one','0',t);const row=await db.prepare('SELECT * FROM inbox WHERE connection_id=?').bind('c').first();
  const item=await saveDecision(db,row,{kind:'review',title:'Data incerta',details:'',start_at:null,due_date:null,confidence:'ambiguous',source_excerpt:'',rationale:'revisar',state:'review'},t);
  const token=await issueSession(env);const req=(confirm)=>new Request(origin+'/api/items/'+item.id+'/ignore',{method:'POST',headers:{origin,cookie:`aurora_session=${token}`,'content-type':'application/json'},body:JSON.stringify({confirm})});
  let r=await handle(req(false),env);assert.equal(r.status,400);assert.equal((await db.prepare('SELECT state FROM academic_items WHERE id=?').bind(item.id).first()).state,'review');
  r=await handle(req(true),env);assert.equal(r.status,200);assert.equal((await db.prepare('SELECT state FROM academic_items WHERE id=?').bind(item.id).first()).state,'ignored');
  r=await handle(req(true),env);assert.equal(r.status,409);
 }finally{close()}
});
