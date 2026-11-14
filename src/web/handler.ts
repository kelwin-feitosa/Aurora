import type {Env,AcademicItem,Connection,OutboxRow} from '../types.ts';
import {securityHeaders,readSession,issueSession,sessionCookie,clearSessionCookie,revokeSession,currentSessionHash,allowedOrigin,configReady,verifyPassphrase,safePublicOrigin} from '../infra/security.ts';
import {sha256,shaHex} from '../infra/crypto.ts';
import {beginOauth,finishOauth,oauthEnabled} from '../providers/oauth.ts';
import {connections,listItems,dailyUsage,audit,getItem,queueEvent} from '../infra/store.ts';
import {runCycle,queueCalendarChange} from '../app/pipeline.ts';
import {getRules,setRules,validateRules} from '../domain/monitoring.ts';
import {pushConfigured,subscribePush,unsubscribePush,listPush,isQuiet,revokePushBySession} from '../app/push.ts';
import {HTML,JS,CSS,PWA_MANIFEST,SERVICE_WORKER,OFFLINE_PAGE,OFFLINE_CSS,INSTALL_HTML,INSTALL_CSS,INSTALL_JS,DEMO_HTML,ICON_192,ICON_512,ICON_MASKABLE} from './ui.ts';

const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8'};
function json(data:unknown,status=200,extra:HeadersInit={}):Response{return new Response(JSON.stringify(data),{status,headers:{...securityHeaders(),...JSON_HEADERS,...extra}});}
function html(s:string,status=200):Response{return new Response(s,{status,headers:{...securityHeaders(),'Content-Type':'text/html; charset=utf-8'}});}
function err(code:string,status=400):Response{return json({ok:false,error:code},status);}
async function readJson(req:Request):Promise<Record<string,unknown>>{
 if(Number(req.headers.get('content-length')||'0')>8192)throw new Error('PAYLOAD_TOO_LARGE');
 if(!(req.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))throw new Error('JSON_CONTENT_TYPE_REQUIRED');
 const stream=req.body?.getReader();if(!stream)throw new Error('INVALID_JSON');
 const chunks:Uint8Array[]=[];let count=0;
 while(true){const {done,value}=await stream.read();if(done)break;count+=value.byteLength;if(count>8192){await stream.cancel();throw new Error('PAYLOAD_TOO_LARGE');}chunks.push(value);}
 const data=new TextDecoder().decode(Uint8Array.from(chunks.flatMap(b=>Array.from(b))));
 const parsed=JSON.parse(data) as unknown;if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('INVALID_JSON');return parsed as Record<string,unknown>;
}
function errorCode(e:unknown):string{
 if(e instanceof Error && /^([A-Z][A-Z0-9_]+)$/.test(e.message))return e.message.slice(0,100);
 return 'UNEXPECTED_ERROR';
}
function sanitizeConn(c:Connection){return {id:c.id,provider:c.provider,account_hint:c.account_hint,calendar_ready:Boolean(c.calendar_id),last_sync_at:c.last_sync_at,last_attempt_at:c.last_attempt_at,last_success_at:c.last_success_at,next_sync_at:c.next_sync_at,last_error:c.last_error,enabled:Boolean(c.enabled),sync_mode:c.sync_mode};}
function sanitizedItem(i:AcademicItem){return {id:i.id,kind:i.kind,title:i.title,details:i.details,start_at:i.start_at,due_date:i.due_date,time_zone:i.time_zone,confidence:i.confidence,rationale:i.rationale,state:i.state,connection_id:i.connection_id};}
function validateDate(s:string):boolean {if(!/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
function validateLocalDateTime(s:string):boolean{
 if(!/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:00$/.test(s))return false;
 // Local clock values near midnight may cross a UTC date boundary. Validate the wall date without timezone conversion.
 return validateDate(s.slice(0,10));
}
async function throttle(env:Env,req:Request,now:number):Promise<{key:string;blocked:boolean}>{
 const hint=req.headers.get('cf-connecting-ip')||'unknown';
 const key=await sha256('ip:'+env.APP_SECRET+':'+hint.slice(0,120));
 const row=await env.DB.prepare('SELECT attempts,last_at FROM auth_attempts WHERE fingerprint=?').bind(key).first<{attempts:number;last_at:number}>();
 return {key,blocked:Boolean(row&&row.attempts>=5&&now-row.last_at<15*60*1000)};
}
async function failedLogin(env:Env,key:string,now:number):Promise<void>{
 await env.DB.prepare('INSERT INTO auth_attempts(fingerprint,attempts,last_at) VALUES(?,1,?) ON CONFLICT(fingerprint) DO UPDATE SET attempts=CASE WHEN ? - last_at > 900000 THEN 1 ELSE attempts+1 END,last_at=excluded.last_at').bind(key,now,now).run();
}
function redirect(url:string):Response{return new Response(null,{status:303,headers:{...securityHeaders(),Location:url}});}
export async function handle(req:Request,env:Env):Promise<Response>{
 try{
  const url=new URL(req.url),route=url.pathname;
  if(req.method==='GET'&&route==='/')return html(HTML);
  if(req.method==='GET'&&route==='/instalar')return html(INSTALL_HTML);
  if(req.method==='GET'&&route==='/demonstracao')return html(DEMO_HTML);
  if(req.method==='GET'&&route==='/offline.html')return html(OFFLINE_PAGE);
  if(req.method==='GET'&&route==='/assets/offline.css')return new Response(OFFLINE_CSS,{headers:{...securityHeaders(),'Content-Type':'text/css; charset=utf-8','Cache-Control':'public, max-age=300'}});
  if(req.method==='GET'&&route==='/sw.js')return new Response(SERVICE_WORKER,{headers:{...securityHeaders(),'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache, no-store','Service-Worker-Allowed':'/'}});
  if(req.method==='GET'&&route==='/assets/manifest.webmanifest')return new Response(PWA_MANIFEST,{headers:{...securityHeaders(),'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'public, max-age=300'}});
  if(req.method==='GET'&&route==='/assets/install.css')return new Response(INSTALL_CSS,{headers:{...securityHeaders(),'Content-Type':'text/css; charset=utf-8','Cache-Control':'public, max-age=300'}});
  if(req.method==='GET'&&route==='/assets/install.js')return new Response(INSTALL_JS,{headers:{...securityHeaders(),'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'public, max-age=300'}});
  const icons:{[key:string]:string}={'/assets/icons/aurora-192.png':ICON_192,'/assets/icons/aurora-512.png':ICON_512,'/assets/icons/aurora-maskable-512.png':ICON_MASKABLE};
  if(req.method==='GET'&&Object.prototype.hasOwnProperty.call(icons,route)){
    const bytes=Uint8Array.from(atob(icons[route]!),c=>c.charCodeAt(0));
    return new Response(bytes,{headers:{...securityHeaders(),'Content-Type':'image/png','Cache-Control':'public, max-age=3600'}});
  }
  if(req.method==='GET'&&route==='/assets/aurora.css')return new Response(CSS,{headers:{...securityHeaders(),'Content-Type':'text/css; charset=utf-8','Cache-Control':'public, max-age=600'}});
  if(req.method==='GET'&&route==='/assets/aurora.js')return new Response(JS,{headers:{...securityHeaders(),'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'public, max-age=600'}});
  if(!route.startsWith('/api/'))return err('NOT_FOUND',404);
  if(url.origin!==safePublicOrigin(env))return err('UNEXPECTED_REQUEST_ORIGIN',403);
  if(!configReady(env))return err('INSTALLATION_SECRETS_NOT_CONFIGURED',503);
  if(route==='/api/session'&&req.method==='GET')return json({logged_in:await readSession(env,req),providers:{gmail:oauthEnabled(env,'gmail'),outlook:oauthEnabled(env,'outlook')}});
  if(route==='/api/login'&&req.method==='POST'){
   if(!allowedOrigin(env,req))return err('INVALID_ORIGIN',403);
   const now=Date.now(),guard=await throttle(env,req,now);if(guard.blocked)return err('TOO_MANY_ATTEMPTS',429);
   const input=await readJson(req),pass=typeof input.passphrase==='string'?input.passphrase:'';
   if(pass.length>1024||!await verifyPassphrase(env,pass)){await failedLogin(env,guard.key,now);return err('INVALID_CREDENTIALS',401);}
   await env.DB.prepare('DELETE FROM auth_attempts WHERE fingerprint=?').bind(guard.key).run();
   const s=await issueSession(env);return json({ok:true},200,{'Set-Cookie':sessionCookie(s)});
  }
  const authorized=await readSession(env,req);
  if(!authorized)return err('AUTH_REQUIRED',401);
  if(!['GET','HEAD'].includes(req.method)&&!allowedOrigin(env,req))return err('INVALID_ORIGIN',403);
  if(route==='/api/logout'&&req.method==='POST'){const session=await currentSessionHash(env,req);if(session)await revokePushBySession(env,session);await revokeSession(env,req);return json({ok:true},200,{'Set-Cookie':clearSessionCookie()});}
  if(route==='/api/push/config'&&req.method==='GET'){
   const session=await currentSessionHash(env,req);if(!session)return err('AUTH_REQUIRED',401);
   const pref=await env.DB.prepare('SELECT quiet_start,quiet_end,quiet_zone FROM push_preferences WHERE id=1').first();
   return json({enabled:pushConfigured(env),public_key:pushConfigured(env)?env.VAPID_PUBLIC_KEY:null,subscriptions:await listPush(env,session),quiet_hours:pref});
  }
  if(route==='/api/push/preferences'&&req.method==='POST'){
   const body=await readJson(req);
   const {quiet_start:start,quiet_end:end,quiet_zone:zone}=body;
   if(typeof start!=='string'||typeof end!=='string'||typeof zone!=='string'||zone.length>60)return err('INVALID_PUSH_PREFERENCES');
   try{isQuiet(Date.now(),zone,start,end);}catch{return err('INVALID_PUSH_PREFERENCES');}
   await env.DB.prepare('UPDATE push_preferences SET quiet_start=?,quiet_end=?,quiet_zone=?,updated_at=? WHERE id=1').bind(start,end,zone,Date.now()).run();
   return json({ok:true});
  }
  if(route==='/api/push/subscribe'&&req.method==='POST'){
   const body=await readJson(req);const session=await currentSessionHash(env,req);if(!session)return err('AUTH_REQUIRED',401);
   if(typeof body.endpoint!=='string')return err('PUSH_ENDPOINT_INVALID');
   const id=await subscribePush(env,session,body.endpoint,body.keys);
   return json({ok:true,id},201);
  }
  if(route==='/api/push/unsubscribe'&&req.method==='POST'){
   const body=await readJson(req);const session=await currentSessionHash(env,req);if(!session)return err('AUTH_REQUIRED',401);
   if(typeof body.id!=='string')return err('PUSH_ID_INVALID');
   return json({ok:await unsubscribePush(env,session,body.id)});
  }

  if(route==='/api/sessions'&&req.method==='GET'){
   const rows=(await env.DB.prepare('SELECT id_hash,created_at,expires_at,revoked_at FROM sessions WHERE expires_at>? ORDER BY created_at DESC LIMIT 25').bind(Date.now()).all()).results;
   return json({sessions:rows,current:await currentSessionHash(env,req)});
  }
  const revoke=route.match(/^\/api\/sessions\/([A-Za-z0-9_-]{43})\/revoke$/);
  if(revoke&&req.method==='POST'){
   const body=await readJson(req);if(body.confirm!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   const now=Date.now();
   if(!env.DB.batch)throw new Error('DB_ATOMIC_BATCH_REQUIRED');
   const [result]=await env.DB.batch([
    env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE id_hash=? AND revoked_at IS NULL').bind(now,revoke[1]),
    env.DB.prepare("UPDATE push_subscriptions SET state='revoked',updated_at=? WHERE session_hash=? AND state='active'").bind(now,revoke[1])
   ]) as Array<{meta?:Record<string,unknown>}>;
   return json({ok:Number(result?.meta?.changes??0)===1});
  }
  if(route==='/api/oauth/start'&&req.method==='POST'){
   const body=await readJson(req),provider=body.provider;
   if(provider!=='gmail'&&provider!=='outlook')return err('UNSUPPORTED_PROVIDER');
   const sessionHash=await currentSessionHash(env,req);if(!sessionHash)return err('AUTH_REQUIRED',401);
   return json({url:await beginOauth(env,provider,sessionHash)});
  }
  const callback=route.match(/^\/api\/oauth\/callback\/(gmail|outlook)$/);
  if(callback&&req.method==='GET'){
   // Callback is a top-level browser redirect; SameSite=Lax cookie is required.
   if(url.searchParams.get('error'))return redirect('/?oauth_error=consent_denied');
   const state=url.searchParams.get('state')??'',code=url.searchParams.get('code')??'';
   try{const sessionHash=await currentSessionHash(env,req);if(!sessionHash)return err('AUTH_REQUIRED',401);await finishOauth(env,callback[1] as 'gmail'|'outlook',state,code,sessionHash);}catch(e){await audit(env.DB,'OAUTH_FAILED',errorCode(e));return redirect('/?oauth_error=connection_failed');}
   return redirect('/?connected=1');
  }
  if(route==='/api/diagnostics'&&req.method==='GET'){
   const checked=Date.now();
   const config={gmail:oauthEnabled(env,'gmail'),outlook:oauthEnabled(env,'outlook')};
   const alive=await env.DB.prepare('SELECT 1 AS ok').first<{ok:number}>();
   const states=(await env.DB.prepare("SELECT key,value FROM runtime_state WHERE key IN ('cron_last_success','cron_last_attempt')").all<{key:string;value:number}>()).results;
   const last=Object.fromEntries(states.map(x=>[x.key,Number(x.value)]));
   const count=await env.DB.prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN last_error IS NOT NULL OR enabled=0 THEN 1 ELSE 0 END) AS errors FROM connections').first<{n:number;errors:number}>();
   const pending=await env.DB.prepare("SELECT COUNT(*) AS n,MIN(received_at) AS oldest FROM inbox WHERE state IN ('queued','retry') AND attempts<5").first<{n:number;oldest:number|null}>();
   const age=checked-Number(last.cron_last_success||0);
   return json({database:alive?.ok===1,providers:config,automation_mode:env.AUTO_APPROVE_MODE==='trusted-senders'?'Remetentes autorizados por configuração (From não autenticado)':'Revisão humana por padrão',connections:count?.n??0,connections_with_error:count?.errors??0,pending_messages:pending?.n??0,oldest_pending_minutes:pending?.oldest?Math.max(0,Math.round((checked-pending.oldest)/60000)):null,cron_status:last.cron_last_success?(age<45*60*1000?'Última execução concluída: '+new Date(Number(last.cron_last_success)).toISOString():'Última execução registrada há mais de 45 minutos. Verifique o agendador.'):'Nenhuma execução automática confirmada. Verifique o Cron Trigger.',checked_at:new Date(checked).toISOString()});
  }
  if(route==='/api/onboarding'&&req.method==='GET'){
   // Status is derived from actual DB, OAuth settings and calendar selection; clicks cannot forge readiness.
   const state=await env.DB.prepare('SELECT notifications_skipped FROM onboarding_progress WHERE id=1').first<{notifications_skipped:number}>();
   const progress=await env.DB.prepare('SELECT COUNT(*) AS total FROM connections WHERE enabled=1').first<{total:number}>();
   const committed=await env.DB.prepare("SELECT 1 AS ok FROM outbox o JOIN connections c ON c.id=o.connection_id WHERE o.state='committed' AND c.calendar_id IS NOT NULL LIMIT 1").first<{ok:number}>();
   const oauth=oauthEnabled(env,'gmail')||oauthEnabled(env,'outlook');
   const session=await currentSessionHash(env,req);const pushes=session?await listPush(env,session):[];
   const steps={DATABASE_READY:true,IDENTITY_CONFIGURED:oauth,ACCOUNT_CONNECTED:Boolean(progress?.total),CALENDAR_TESTED:Boolean(committed?.ok),NOTIFICATIONS_OPT_IN_OR_SKIPPED:Boolean(state?.notifications_skipped||pushes.length)};
   const order=Object.entries(steps);
   const next=order.find(([,ready])=>!ready)?.[0]??'COMPLETE';
   return json({steps,next,complete:next==='COMPLETE'});
  }
  if(route==='/api/onboarding/skip-notifications'&&req.method==='POST'){
   const body=await readJson(req);
   if(body.confirm!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   await env.DB.prepare('UPDATE onboarding_progress SET notifications_skipped=1,updated_at=? WHERE id=1').bind(Date.now()).run();
   return json({ok:true});
  }
  const rescanRoute=route.match(/^\/api\/connections\/(conn_[a-f0-9]{32}|[a-zA-Z0-9_-]{1,60})\/monitoring\/rescan$/);
  if(rescanRoute&&req.method==='POST'){
   const body=await readJson(req);if(body.confirm!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   const cid=rescanRoute[1]!,now=Date.now();
   // Bounded atomic requeue. No direct remote calendar action or cursor reset.
   if(!env.DB.batch)throw new Error('DB_ATOMIC_BATCH_REQUIRED');
   const ids=(await env.DB.prepare('SELECT inbox_id FROM monitoring_skips WHERE connection_id=? AND at>=? ORDER BY at DESC LIMIT 12').bind(cid,now-30*86400000).all<{inbox_id:number}>()).results.map(x=>x.inbox_id);
   if(ids.length){
    const placeholders=ids.map(()=>'?').join(',');
    await env.DB.batch([
     env.DB.prepare(`UPDATE inbox SET state='queued',attempts=0,next_attempt_at=0,last_error=NULL WHERE id IN (${placeholders}) AND connection_id=?`).bind(...ids,cid),
     env.DB.prepare(`DELETE FROM monitoring_skips WHERE inbox_id IN (${placeholders}) AND connection_id=?`).bind(...ids,cid)
    ]);
   }
   await audit(env.DB,'MONITORING_RESCAN_REQUESTED',ids.length?'BATCH':'EMPTY');
   return json({ok:true,requeued:ids.length,notice:'As mensagens selecionadas serão reavaliadas nas próximas verificações, sujeitas ao orçamento gratuito.'});
  }
  const monitoringRoute=route.match(/^\/api\/connections\/(conn_[a-f0-9]{32}|[a-zA-Z0-9_-]{1,60})\/monitoring$/);
  if(monitoringRoute&&req.method==='POST'){
   const connectionId=monitoringRoute[1]!;
   const exists=await env.DB.prepare('SELECT 1 AS ok FROM connections WHERE id=?').bind(connectionId).first();
   if(!exists)return err('CONNECTION_NOT_FOUND',404);
   const input=await readJson(req);
   const rules=validateRules(input);
   await setRules(env.DB,connectionId,rules,Date.now());
   await audit(env.DB,'MONITORING_RULES_UPDATED',rules.mode);
   return json({ok:true,mode:rules.mode,notice:'Configurações aplicadas às próximas mensagens. Mensagens já concluídas não são relidas automaticamente.'});
  }
  if(route==='/api/data'&&req.method==='GET'){
   const conn=await connections(env.DB),items=await listItems(env.DB),usage=await dailyUsage(env.DB,Date.now()),preferences=await env.DB.prepare('SELECT event_reminder_minutes,task_reminder_minutes FROM preferences WHERE id=1').first();
   const monitoring=Object.fromEntries(await Promise.all(conn.map(async c=>[c.id,await getRules(env.DB,c.id)])));
   const monitoringSkips=(await env.DB.prepare('SELECT connection_id,COUNT(*) AS total FROM monitoring_skips GROUP BY connection_id LIMIT 100').all()).results;
   const monitoringCounts=(await env.DB.prepare("SELECT connection_id,reason,SUM(count) AS total FROM monitoring_daily GROUP BY connection_id,reason ORDER BY connection_id,reason LIMIT 100").all()).results;
   const stuck=(await env.DB.prepare("SELECT id,connection_id,last_error,attempts FROM inbox WHERE state='retry' AND attempts>=5 ORDER BY id DESC LIMIT 20").all()).results;
   const changes=(await env.DB.prepare("SELECT id,item_id,action,state,last_error FROM calendar_changes WHERE state!='committed' ORDER BY updated_at DESC LIMIT 30").all()).results;
   const actions=(await env.DB.prepare("SELECT o.id,o.item_id,o.state,o.attempt_count,o.last_error FROM outbox o WHERE state!='committed' ORDER BY updated_at DESC LIMIT 30").all<Pick<OutboxRow,'id'|'item_id'|'state'|'attempt_count'|'last_error'>>()).results;
   return json({connections:conn.map(sanitizeConn),monitoring,monitoringCounts,monitoringSkips,items:items.map(sanitizedItem),outbox:actions,changes,stuck,usage,preferences,now:new Date().toISOString()});
  }
  if(route==='/api/preferences'&&req.method==='POST'){
   const body=await readJson(req);
   const allowedEvent=[0,30,60,120,1440,10080],allowedTask=[0,1440,2880,10080];
   const ev=body.event_reminder_minutes,task=body.task_reminder_minutes;
   if(typeof ev!=='number'||typeof task!=='number'||!allowedEvent.includes(ev)||!allowedTask.includes(task))return err('INVALID_REMINDER_PREFERENCES');
   await env.DB.prepare('UPDATE preferences SET event_reminder_minutes=?,task_reminder_minutes=?,updated_at=? WHERE id=1').bind(ev,task,Date.now()).run();
   return json({ok:true});
  }
  if(route==='/api/sync'&&req.method==='POST'){
   // Synchronous manual sync for testing; normal operation occurs by cron without tab open.
   const now=Date.now();const reserve=await env.DB.prepare("INSERT INTO runtime_state(key,value) VALUES('manual_sync',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE value<?").bind(now,now-60000).run();
   if(Number(reserve.meta?.changes??0)!==1)return err('MANUAL_SYNC_COOLDOWN',429);
   await runCycle(env);return json({ok:true});
  }
  if(route==='/api/export'&&req.method==='GET'){
   const rawCursor=url.searchParams.get('cursor');
   if(rawCursor&&!/^\d{1,16}\.item_[a-f0-9]{32}$/.test(rawCursor))return err('INVALID_EXPORT_CURSOR');
   const [afterAt,afterId]=rawCursor?rawCursor.split('.'):['253402300799000','item_ffffffffffffffffffffffffffffffff'];
   const batch=(await env.DB.prepare(`SELECT id,kind,title,details,start_at,due_date,time_zone,confidence,rationale,state,connection_id,created_at,updated_at
    FROM academic_items WHERE (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 101`).bind(Number(afterAt),Number(afterAt),afterId).all<AcademicItem>()).results;
   const hasMore=batch.length>100,items=batch.slice(0,100),tail=items.at(-1);
   const cs=await connections(env.DB);
   return json({version:2,exported_at:new Date().toISOString(),connections:cs.map(sanitizeConn),items:items.map(sanitizedItem),
    partial:hasMore,next_cursor:hasMore&&tail?`${tail.created_at}.${tail.id}`:null},200,{'Content-Disposition':'attachment; filename="aurora-export-page.json"'});
  }
  const approve=route.match(/^\/api\/items\/(item_[a-f0-9]{32})\/review$/);
  if(approve&&req.method==='POST'){
   const input=await readJson(req),item=await getItem(env.DB,approve[1]!);
   if(!item)return err('ITEM_NOT_FOUND',404);if(item.state!=='review')return err('ITEM_NOT_REVIEWABLE',409);
   const kind=input.kind,now=Date.now();
   if(kind!=='event'&&kind!=='task')return err('UNSUPPORTED_REVIEW_TYPE');
   const value=kind==='event'?input.start_at:input.due_date;
   if(typeof value!=='string'||!(kind==='event'?validateLocalDateTime(value):validateDate(value)))return err(kind==='event'?'INVALID_EVENT_DATETIME':'INVALID_TASK_DATE');
   const normalizedTitle=item.title.normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
   const fingerprint=(await shaHex(`${kind}:${normalizedTitle}:${value}`)).slice(0,36);
   // Atomic duplicate defense: approval cannot bypass the dedup checks applied to
   // automatically extracted items. No network operations occur on conflict.
   const changed=await env.DB.prepare(`UPDATE academic_items SET kind=?,state='approved',confidence='explicit',start_at=?,due_date=?,fingerprint=?,rationale='Confirmado manualmente pelo titular',updated_at=?
    WHERE id=? AND state='review' AND NOT EXISTS (
     SELECT 1 FROM academic_items other WHERE other.connection_id=? AND other.fingerprint=? AND other.state IN ('approved','synced') AND other.id<>?
    )`).bind(kind,kind==='event'?value:null,kind==='task'?value:null,fingerprint,now,item.id,item.connection_id,fingerprint,item.id).run();
   if(Number(changed.meta?.changes??0)!==1)return err('POSSIBLE_DUPLICATE_REVIEW_REQUIRED',409);
   const updated=await getItem(env.DB,item.id);if(updated)await queueEvent(env.DB,updated,now);
   await audit(env.DB,'ITEM_APPROVED','manual');return json({ok:true});
  }
  const ignore=route.match(/^\/api\/items\/(item_[a-f0-9]{32})\/ignore$/);
  if(ignore&&req.method==='POST'){
   const input=await readJson(req);if(input.confirm!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   const updated=await env.DB.prepare("UPDATE academic_items SET state='ignored',rationale='Ignorado manualmente pelo titular',updated_at=? WHERE id=? AND state IN ('review','notice')").bind(Date.now(),ignore[1]).run();
   if(Number(updated.meta?.changes??0)!==1)return err('ITEM_NOT_IGNORABLE',409);
   await audit(env.DB,'ITEM_IGNORED','manual');return json({ok:true});
  }
  const stuckRetry=route.match(/^\/api\/inbox\/(\d{1,16})\/retry$/);
  if(stuckRetry&&req.method==='POST'){
   const body=await readJson(req);if(body.confirm!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   const updated=await env.DB.prepare("UPDATE inbox SET attempts=0,next_attempt_at=0,last_error=NULL WHERE id=? AND attempts>=5 AND state='retry'").bind(Number(stuckRetry[1])).run();
   if(Number(updated.meta?.changes??0)!==1)return err('NOT_STUCK',409);
   await audit(env.DB,'INBOX_REQUEUED','manual');return json({ok:true});
  }
  const calendarChange=route.match(/^\/api\/items\/(item_[a-f0-9]{32})\/calendar-change$/);
  if(calendarChange&&req.method==='POST'){
   const body=await readJson(req),item=await getItem(env.DB,calendarChange[1]!);
   if(!item)return err('ITEM_NOT_FOUND',404);
   if(item.state!=='synced')return err('ITEM_NOT_SYNCED',409);
   const action=body.action;if(action!=='update'&&action!=='cancel')return err('INVALID_CALENDAR_CHANGE');
   if(action==='cancel'&&body.confirm!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   let title=item.title,start_at:undefined|string,due_date:undefined|string;
   if(action==='update'){
    if(typeof body.title==='string'){title=body.title.trim();if(!title||title.length>140||/[\x00-\x1f]/.test(title))return err('INVALID_TITLE');}
    if(item.kind==='event'){
     if(typeof body.start_at!=='string'||!validateLocalDateTime(body.start_at))return err('INVALID_EVENT_DATETIME');start_at=body.start_at;
    }else if(item.kind==='task'){
     if(typeof body.due_date!=='string'||!validateDate(body.due_date))return err('INVALID_TASK_DATE');due_date=body.due_date;
    }else return err('ITEM_NOT_SYNCED',409);
   }
   try{const id=await queueCalendarChange(env,item.id,{action,start_at,due_date,title},Date.now());await audit(env.DB,'CALENDAR_CHANGE_QUEUED',action);return json({ok:true,id},202);}
   catch(e){return err(errorCode(e),409);}
  }
  const changeRetry=route.match(/^\/api\/calendar-changes\/(chg_[a-f0-9]{32})\/retry$/);
  if(changeRetry&&req.method==='POST'){
   const body=await readJson(req);if(body.confirmRisk!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   const result=await env.DB.prepare("UPDATE calendar_changes SET state='retryable',next_attempt_at=0,locked_until=0,last_error='USER_REQUESTED_RETRY' WHERE id=? AND state='blocked'").bind(changeRetry[1]).run();
   return Number(result.meta?.changes??0)===1?json({ok:true}):err('ACTION_NOT_BLOCKED',409);
  }
  const retry=route.match(/^\/api\/outbox\/(act_[a-f0-9]{32})\/retry$/);
  if(retry&&req.method==='POST'){
   const input=await readJson(req);if(input.confirmRisk!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   const r=await env.DB.prepare("UPDATE outbox SET state='retryable',next_attempt_at=0,locked_until=0,last_error='USER_REQUESTED_RETRY' WHERE id=? AND state='blocked'").bind(retry[1]).run();
   if(Number(r.meta?.changes??0)!==1)return err('ACTION_NOT_BLOCKED',409);
   await audit(env.DB,'OUTBOX_USER_RETRY','user_confirmed_risk');return json({ok:true});
  }
  const resume=route.match(/^\/api\/connections\/([0-9a-f-]{36})\/resume$/);
  if(resume&&req.method==='POST'){
   const input=await readJson(req);if(input.confirm!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   const result=await env.DB.prepare("UPDATE connections SET enabled=1,last_error=NULL,updated_at=? WHERE id=? AND enabled=0").bind(Date.now(),resume[1]).run();
   if(Number(result.meta?.changes??0)!==1)return err('NOT_PAUSED_OR_MISSING',409);
   await audit(env.DB,'CONNECTION_RESUMED','user_acknowledged_restore');return json({ok:true});
  }
  const disconnect=route.match(/^\/api\/connections\/([0-9a-f-]{36})\/disconnect$/);
  if(disconnect&&req.method==='POST'){
   const input=await readJson(req);if(input.confirm!==true)return err('EXPLICIT_CONFIRMATION_REQUIRED');
   // Local removal: remote calendar remains owned by user; revoke separately in provider account security UI.
   await env.DB.prepare('DELETE FROM connections WHERE id=?').bind(disconnect[1]).run();
   await audit(env.DB,'CONNECTION_DELETED','local_only');return json({ok:true});
  }
  return err('NOT_FOUND',404);
 }catch(e){return err(errorCode(e),errorCode(e)==='PAYLOAD_TOO_LARGE'?413:400);}
}
