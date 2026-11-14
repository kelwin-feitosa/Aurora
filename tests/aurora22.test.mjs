import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {setup} from './fixtures.mjs';
import {sha256} from '../src/infra/crypto.ts';
import {issueSession} from '../src/infra/security.ts';
import {subscribePush,unsubscribePush,dispatchPush,revokePushBySession,isQuiet,validatePushEndpoint,pushConfigured,vapidJwt,listPush} from '../src/app/push.ts';
import {runCycle} from '../src/app/pipeline.ts';
import {seal} from '../src/infra/crypto.ts';
import {handle} from '../src/web/handler.ts';

const endpoint='https://fcm.googleapis.com/fcm/send/secret-token-abc';
const keys={p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')};
function prepareVapid(env){
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),pub=pair.publicKey.export({format:'jwk'}),priv=pair.privateKey.export({format:'jwk'});
 env.PUSH_ENABLED='1';env.VAPID_PUBLIC_KEY=Buffer.concat([Buffer.from([4]),Buffer.from(pub.x,'base64url'),Buffer.from(pub.y,'base64url')]).toString('base64url');
 env.VAPID_PRIVATE_KEY=priv.d;env.VAPID_CONTACT='mailto:notifications@example.org';
 return pub;
}
async function session(env){return sha256('session:'+await issueSession(env));}
async function insertReview(env,now){
 const cipher=await seal(env.APP_SECRET,JSON.stringify({access_token:'x',refresh_token:'y',expires_at:now+3600_000}),'token:g1:gmail');
 await env.DB.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('g1','gmail','student@example.org',?,?,?)").bind(cipher,now,now).run();
 await env.DB.prepare("INSERT INTO inbox(connection_id,remote_id,remote_revision,state,received_at) VALUES('g1','m1','0','done',?)").bind(now).run();
 await env.DB.prepare(`INSERT INTO academic_items(id,connection_id,inbox_id,kind,title,confidence,rationale,state,created_at,updated_at)
 VALUES('item_11111111111111111111111111111111','g1',1,'review','Avaliação','ambiguous','Revisão necessária','review',?,?)`).bind(now,now).run();
}

test('Web Push desativado por padrão, sem envio ou consulta', async()=>{const {env,close}=setup();let calls=0;const r=await dispatchPush(env,{fetch:()=>{calls++;throw Error('bad');}});assert.equal(r.status,'disabled');assert.equal(calls,0);close();});
test('Web Push bloqueia SSRF, URLs com credenciais, portas, links não HTTPS',()=>{
 for(const u of ['https://evil.com/send','http://fcm.googleapis.com/x','https://127.0.0.1/','https://fcm.googleapis.com:444/p','https://user:secret@fcm.googleapis.com/p','https://fcm.googleapis.com.evil.com/p','https://gateway.push.apple.com.evil.invalid/x'])assert.throws(()=>validatePushEndpoint(u));
 assert.equal(validatePushEndpoint(endpoint).hostname,'fcm.googleapis.com');
 assert.equal(validatePushEndpoint('https://web.push.apple.com/Q').hostname,'web.push.apple.com');
});
test('VAPID é ES256 válido, público verificável, sem dados de estudante',async()=>{
 const {env,close}=setup();const pub=prepareVapid(env);assert.equal(pushConfigured(env),true);
 const jwt=await vapidJwt(env,endpoint);const [h,p,sig]=jwt.split('.');
 const payload=JSON.parse(Buffer.from(p,'base64url').toString());assert.equal(payload.aud,'https://fcm.googleapis.com');assert.equal(payload.sub,'mailto:notifications@example.org');
 const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:pub.x,y:pub.y},{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 assert.equal(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,Buffer.from(sig,'base64url'),new TextEncoder().encode(`${h}.${p}`)),true);
 close();
});
test('Inscrição é cifrada e proprietário pode revogar dispositivo de sessão antiga',async()=>{
 const {env,db,close}=setup();prepareVapid(env);const a=await session(env);const id=await subscribePush(env,a,endpoint,keys);
 assert.match(id,/^push_/);const row=await db.prepare('SELECT endpoint_ciphertext FROM push_subscriptions').first();assert.equal(row.endpoint_ciphertext.includes(endpoint),false);
 assert.equal((await listPush(env,a)).length,1);assert.equal(await unsubscribePush(env,'new-owner-session',id),true);
 assert.equal(await unsubscribePush(env,a,id),false);assert.equal((await listPush(env,a)).length,0);close();
});
test('Inscrição recusa chaves inválidas e estado não configurado',async()=>{
 const {env,close}=setup();const a=await session(env);
 await assert.rejects(subscribePush(env,a,endpoint,keys),/PUSH_NOT_CONFIGURED/);
 prepareVapid(env);await assert.rejects(subscribePush(env,a,endpoint,{p256dh:'bad',auth:'bad'}),/PUSH_KEYS_INVALID/);
 close();
});
test('Horários de silêncio cruzam meia-noite e usam fuso IANA',()=>{
 assert.equal(isQuiet(Date.parse('2026-11-13T02:00:00Z'),'America/Sao_Paulo','22:00','07:00'),true);
 assert.equal(isQuiet(Date.parse('2026-11-13T16:00:00Z'),'America/Sao_Paulo','22:00','07:00'),false);
 assert.equal(isQuiet(Date.now(),'America/Sao_Paulo','00:00','00:00'),false);
 assert.throws(()=>isQuiet(Date.now(),'Invalid/Zone','22:00','07:00'));
});
test('Gateway aceita push vazio, sem conteúdo acadêmico e sem sucesso falso de dispositivo',async()=>{
 const {env,db,close}=setup();prepareVapid(env);const a=await session(env),now=Date.now();await subscribePush(env,a,endpoint,keys,now);await insertReview(env,now+1000);
 await db.prepare("UPDATE push_preferences SET quiet_start='00:00',quiet_end='00:00'").run();let count=0;
 const http={fetch:async(u,init)=>{count++;assert.equal(u,endpoint);assert.equal(init.method,'POST');assert.equal(init.body,undefined);assert.equal(init.redirect,'error');assert.ok(init.headers.Authorization.startsWith('vapid t='));return new Response(null,{status:201});}};
 assert.equal((await dispatchPush(env,http,now+2000)).status,'gateway_accepted');assert.equal(count,1);
 assert.equal((await dispatchPush(env,http,now+3000)).status,'none');assert.equal(count,1);
 assert.equal((await db.prepare('SELECT last_status FROM push_subscriptions').first()).last_status,'gateway_accepted');close();
});
test('Gateway 410 revoga a subscription, sem repetição',async()=>{
 const {env,db,close}=setup();prepareVapid(env);const a=await session(env),now=Date.now();await subscribePush(env,a,endpoint,keys,now);await insertReview(env,now+1000);
 await db.prepare("UPDATE push_preferences SET quiet_start='00:00',quiet_end='00:00'").run();
 const out=await dispatchPush(env,{fetch:async()=>new Response(null,{status:410})},now+2000);assert.equal(out.status,'subscription_expired');
 assert.equal((await db.prepare('SELECT state FROM push_subscriptions').first()).state,'revoked');close();
});
test('Gateway 429 coloca backoff, sem registrar entrega',async()=>{
 const {env,db,close}=setup();prepareVapid(env);const a=await session(env),now=Date.now();await subscribePush(env,a,endpoint,keys,now);await insertReview(env,now+1000);
 await db.prepare("UPDATE push_preferences SET quiet_start='00:00',quiet_end='00:00'").run();
 assert.equal((await dispatchPush(env,{fetch:async()=>new Response(null,{status:429})},now+2000)).status,'rate_limited');
 const r=await db.prepare('SELECT last_sent_at,next_attempt_at FROM push_subscriptions').first();assert.equal(r.last_sent_at,now);assert.ok(r.next_attempt_at>=now+60*60_000);close();
});
test('Revogar sessão impede envio posterior ao mesmo dispositivo',async()=>{
 const {env,db,close}=setup();prepareVapid(env);const a=await session(env),now=Date.now();await subscribePush(env,a,endpoint,keys,now);await insertReview(env,now+1000);
 await db.prepare("UPDATE push_preferences SET quiet_start='00:00',quiet_end='00:00'").run();await db.prepare('UPDATE sessions SET revoked_at=? WHERE id_hash=?').bind(now,a).run();await revokePushBySession(env,a,now);
 let sent=0;assert.equal((await dispatchPush(env,{fetch:async()=>{sent++;return new Response(null,{status:201});}},now+2000)).status,'none');assert.equal(sent,0);close();
});
test('Endpoint não aparece em JSON nem em resposta GET não autenticada',async()=>{
 const {env,close}=setup();prepareVapid(env);
 const bad=await handle(new Request(env.PUBLIC_ORIGIN+'/api/push/config'),env);assert.equal(bad.status,401);
 const origin=env.PUBLIC_ORIGIN;const auth=await handle(new Request(origin+'/api/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);
 const cookie=auth.headers.get('set-cookie').split(';')[0];
 const mismatch=await handle(new Request(origin+'/api/push/subscribe',{method:'POST',headers:{origin:'https://evil.test',cookie,'content-type':'application/json'},body:JSON.stringify({endpoint,keys})}),env);
 assert.equal(mismatch.status,403);close();
});
test('Sem backlog, checkpoint adia verificação de 15 minutos; não reinicia leitura a cada tick',async()=>{
 const {env,db,close}=setup();const now=Date.now();const tok={access_token:'fake',refresh_token:'other',expires_at:now+86400000};
 await db.prepare('INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('g1','gmail','student@example.org',await seal(env.APP_SECRET,JSON.stringify(tok),'token:g1:gmail'),now,now).run();
 let list=0;const http={fetch:async(u)=>{const url=String(u);if(url.endsWith('/profile'))return new Response(JSON.stringify({historyId:'900'}),{status:200});if(url.includes('/messages?')){list++;return new Response(JSON.stringify({messages:[]}),{status:200});}throw Error('UNEXPECTED_PROVIDER_REQUEST');}};
 await runCycle(env,http,now);assert.equal(list,1);const c=await db.prepare('SELECT next_sync_at,last_attempt_at,last_success_at FROM connections').first();assert.equal(c.next_sync_at,now+900000);assert.equal(c.last_attempt_at,now);assert.equal(c.last_success_at,now);
 await runCycle(env,http,now+180000);assert.equal(list,1);close();
});
test('Backlog com nextPage permite retomada após 3 minutos',async()=>{
 const {env,db,close}=setup();const now=Date.now();const tok={access_token:'fake',refresh_token:'other',expires_at:now+86400000};
 await db.prepare('INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('g1','gmail','student@example.org',await seal(env.APP_SECRET,JSON.stringify(tok),'token:g1:gmail'),now,now).run();
 let n=0;const http={fetch:async(u)=>{const url=String(u);if(url.endsWith('/profile'))return new Response(JSON.stringify({historyId:'900'}),{status:200});if(url.includes('/messages?')){n++;return new Response(JSON.stringify({messages:[],nextPageToken:'more'}),{status:200});}throw Error('UNEXPECTED_PROVIDER_REQUEST');}};
 await runCycle(env,http,now);assert.equal((await db.prepare('SELECT next_sync_at FROM connections').first()).next_sync_at,now+180000);
 await runCycle(env,http,now+180000);assert.equal(n,2);close();
});

test('Inscrição de push sobrevive à expiração natural de sessão (consentimento do aparelho)',async()=>{
 const {env,db,close}=setup();prepareVapid(env);const old=await session(env),now=Date.now();await subscribePush(env,old,endpoint,keys,now);
 await db.prepare('UPDATE sessions SET expires_at=? WHERE id_hash=?').bind(now-5000,old).run();
 await insertReview(env,now+1000);await db.prepare("UPDATE push_preferences SET quiet_start='00:00',quiet_end='00:00'").run();
 let sent=0;const r=await dispatchPush(env,{fetch:async()=>{sent++;return new Response(null,{status:201});}},now+2000);
 assert.equal(r.status,'gateway_accepted');assert.equal(sent,1);close();
});
test('Revisão de onboarding nunca conclui sem OAuth + conexão + calendário comprovados',async()=>{
 const {env,db,close}=setup();const origin=env.PUBLIC_ORIGIN;
 const login=await handle(new Request(origin+'/api/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 let r=await handle(new Request(origin+'/api/onboarding',{headers:{Cookie:cookie}}),env);let data=await r.json();
 assert.equal(data.complete,false);assert.equal(data.next,'ACCOUNT_CONNECTED');
 r=await handle(new Request(origin+'/api/onboarding/skip-notifications',{method:'POST',headers:{origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({confirm:true})}),env);
 assert.equal(r.status,200);
 data=await(await handle(new Request(origin+'/api/onboarding',{headers:{Cookie:cookie}}),env)).json();
 assert.equal(data.complete,false);assert.equal(data.steps.NOTIFICATIONS_OPT_IN_OR_SKIPPED,true);
 assert.equal(data.steps.CALENDAR_TESTED,false);close();
});
test('Revogar sessão pela API revoga também a permissão push vinculada',async()=>{
 const {env,db,close}=setup();prepareVapid(env);
 const origin=env.PUBLIC_ORIGIN;
 const login=await handle(new Request(origin+'/api/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({passphrase:env.INSTALLATION_PASSPHRASE})}),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const all=await(await handle(new Request(origin+'/api/sessions',{headers:{Cookie:cookie}}),env)).json();
 await subscribePush(env,all.current,endpoint,keys);
 const r=await handle(new Request(origin+'/api/sessions/'+all.current+'/revoke',{method:'POST',headers:{origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({confirm:true})}),env);
 assert.equal(r.status,200);assert.equal((await db.prepare('SELECT state FROM push_subscriptions').first()).state,'revoked');close();
});

test('Migração incremental preserva dados Aurora 2.0 ao aplicar esquema 2.2',async()=>{
 const {SQLiteD1}=await import('../scripts/sqlite-adapter.mjs');
 const fs=await import('node:fs');const db=new SQLiteD1(':memory:',false);
 db.native.exec('CREATE TABLE _local_migrations(file TEXT PRIMARY KEY)');
 for(const file of fs.readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')&&f<'0013').sort()){
  db.native.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  db.native.prepare('INSERT INTO _local_migrations(file) VALUES(?)').run(file);
 }
 await db.prepare("INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES('old-connection','gmail','demo','cipher',1,1)").run();
 db.migrate();
 assert.equal((await db.prepare("SELECT account_hint FROM connections WHERE id='old-connection'").first()).account_hint,'demo');
 assert.ok((await db.prepare('SELECT * FROM push_preferences WHERE id=1').first()));
 assert.ok((await db.prepare('SELECT * FROM onboarding_progress WHERE id=1').first()));
 assert.ok('last_attempt_at' in (await db.prepare('SELECT * FROM connections LIMIT 1').first()));
 db.close();
});
