import type {Env,Connection,ProviderHTTP,ProviderId,OutboxRow,AcademicItem,CalendarChange} from '../types.ts';
import {GmailAdapter} from '../providers/gmail.ts';
import {OutlookAdapter} from '../providers/outlook.ts';
import {ApiError} from '../providers/http.ts';
import type {MailCalendarAdapter} from '../providers/adapter.ts';
import {validAccessToken} from '../providers/oauth.ts';
import {getRules,triageEnvelope,shouldRead,evaluateScope,recordFiltered} from '../domain/monitoring.ts';
import {applyAutomationPolicy} from '../domain/trust.ts';
import {connections,pendingInbox,pendingOutbox,saveDecisions,queueEvent,getItem,incrementUsage,dailyUsage,audit,reserveProviderCall,reserveCalendarMutation} from '../infra/store.ts';
import {shaHex} from '../infra/crypto.ts';

/** A deliberately conservative per-cycle outbound call budget; see docs/CUSTOS.md. */
export function meteredProviderHTTP(env:Env,http:ProviderHTTP,maxPerCycle=16,now=Date.now()):ProviderHTTP{
 let calls=0;
 return {async fetch(input,init){
  if(calls>=maxPerCycle)throw new Error('CYCLE_PROVIDER_CALL_CAP');
  calls++;
  await reserveProviderCall(env.DB,now);
  return http.fetch(input,init);
 }};
}
export function adapter(p:ProviderId,http:ProviderHTTP):MailCalendarAdapter{return p==='gmail'?new GmailAdapter(http):new OutlookAdapter(http);}
function errCode(e:unknown):string{
 if(e instanceof ApiError)return e.code;
 if(e instanceof Error && /^([A-Z_]+)$/.test(e.message))return e.message.slice(0,70);
 return 'PROVIDER_FAILURE';
}
const maxDaily=200;
export async function syncConnection(env:Env,conn:Connection,http:ProviderHTTP={fetch:globalThis.fetch},now=Date.now()):Promise<void>{
 const maxMessages=Math.max(1,Math.min(2,Number(env.SYNC_LIMIT??'1')||1));
 const claimed=await env.DB.prepare('UPDATE connections SET locked_until=?,last_attempt_at=? WHERE id=? AND locked_until<=? AND enabled=1').bind(now+120000,now,conn.id,now).run();
 if(Number(claimed.meta?.changes??0)!==1)return;
 try{
  const usage=await dailyUsage(env.DB,now);
  if(usage.mail_reads>=maxDaily)throw new Error('DAILY_MAIL_READ_CAP');
  const rules=await getRules(env.DB,conn.id);
  const token=await validAccessToken(env,conn,http);
  const impl=adapter(conn.provider,http);
  const page=await impl.listChanges(token,conn,Math.min(maxMessages,Math.max(1,maxDaily-usage.mail_reads)));
  if(page.messages.length>30)throw new Error('PAGE_TOO_LARGE_FAIL_CLOSED');
  // Atomic enqueue + checkpoint. If enqueue fails, do not advance remote cursor.
  const statements=page.messages.map(m=>env.DB.prepare('INSERT OR IGNORE INTO inbox(connection_id,remote_id,remote_revision,received_at) VALUES(?,?,?,?)').bind(conn.id,m.id,m.revision,now));
  // Backlog pages are checked frequently; healthy quiet mailboxes keep the 15-minute cadence.
  // This changes no durable cursor semantics and adds no SQL round trip.
  const nextPoll=now+(page.nextPage?3*60_000:15*60_000);
  statements.push(env.DB.prepare(`UPDATE connections SET sync_page=?,sync_anchor=?,sync_cursor=COALESCE(?,sync_cursor),sync_mode=?,last_sync_at=?,last_success_at=?,last_error=NULL,next_sync_at=?,updated_at=? WHERE id=?`)
     .bind(page.nextPage,page.nextPage?page.anchor:null,page.nextCursor,page.nextCursor?'delta':conn.sync_mode,now,now,nextPoll,now,conn.id));
  if(!env.DB.batch)throw new Error('DB_ATOMIC_BATCH_REQUIRED');
  await env.DB.batch(statements);
  const pending=await pendingInbox(env.DB,conn.id,now,maxMessages);
  // Cache only this provider page in memory; no private header persistence in D1.
  const pageEnvelopes=new Map(page.messages.filter(m=>m.envelope).map(m=>[m.id,m.envelope!]));
  let usedMailReads=usage.mail_reads;
  for(const row of pending){
   if(usedMailReads>=maxDaily)break;
   try{
    const envelope=pageEnvelopes.get(row.remote_id)??await impl.fetchEnvelope(token,row.remote_id);
    const choice=triageEnvelope(envelope,rules);
    // A voluntary rescan must not silently apply the same filter again.
    // Explicit blocklists and sensitive-category opt-out remain authoritative.
    const protectedSkip=choice.reason==='EXPLICITLY_BLOCKED_SOURCE'||choice.reason==='SENSITIVE_CATEGORY_OPT_OUT';
    if(!shouldRead(choice,rules)&&(row.force_full_read!==1||protectedSkip)){
     await recordFiltered(env.DB,conn.id,row.id,choice.reason,now);
     continue;
    }
    const msg=await impl.fetchMessage(token,row.remote_id);
    await incrementUsage(env.DB,'mail_reads',now);usedMailReads++;
    const results=applyAutomationPolicy(env,msg,evaluateScope(msg,rules));
    const items=await saveDecisions(env.DB,row,results,now);
    for(const item of items)await queueEvent(env.DB,item,now);
    await env.DB.prepare("UPDATE inbox SET state='done',last_error=NULL,force_full_read=0 WHERE id=? AND connection_id=?").bind(row.id,conn.id).run();
   }catch(e){
    const code=errCode(e),attempts=row.attempts+1;
    const retry=attempts<5;
    await env.DB.prepare("UPDATE inbox SET state='retry',attempts=?,next_attempt_at=?,last_error=? WHERE id=?").bind(attempts,retry?now+Math.min(3_600_000,60000*2**Math.min(attempts,6)):253402300799000,retry?code:'MAIL_STUCK_MANUAL_RETRY_REQUIRED',row.id).run();
    await incrementUsage(env.DB,'errors',now);
    await env.DB.prepare('UPDATE connections SET last_error=?,updated_at=? WHERE id=?').bind(code==='UNAUTHORIZED'||code==='FORBIDDEN'?'RECONNECT_REQUIRED':'MAIL_MESSAGE_RETRY',now,conn.id).run();
    if(!retry&&attempts===5) await audit(env.DB,'MAIL_STUCK',code,now);
   }
  }
 }catch(e){
  const code=errCode(e);
  if(e instanceof ApiError&&(e.code==='GMAIL_CURSOR_EXPIRED'||e.code==='GRAPH_DELTA_EXPIRED')){
   await env.DB.prepare("UPDATE connections SET sync_mode='bootstrap',sync_cursor=NULL,sync_page=NULL,sync_anchor=NULL,last_error='CURSOR_EXPIRED_REBUILD',updated_at=? WHERE id=?").bind(now,conn.id).run();
  }else if(['UNAUTHORIZED','FORBIDDEN','TOKEN_EXCHANGE_400','TOKEN_REFRESH_FAILED'].includes(code)){
   await env.DB.prepare("UPDATE connections SET enabled=0,last_error='RECONNECT_REQUIRED',updated_at=? WHERE id=?").bind(now,conn.id).run();
  }else {
   // A failed mailbox should not monopolize the least-recently-synced slot.
   // Retry after a bounded cooldown while healthy accounts continue normally.
   const cooldown=code==='RATE_LIMITED'?60*60_000:30*60_000;
   await env.DB.prepare('UPDATE connections SET last_error=?,next_sync_at=?,updated_at=? WHERE id=?').bind(code,now+cooldown,now,conn.id).run();
  }
  await incrementUsage(env.DB,'errors',now);
 }finally{await env.DB.prepare('UPDATE connections SET locked_until=0 WHERE id=? AND locked_until=?').bind(conn.id,now+120000).run();}
}
/** Stable Google event ID uses base32hex-legal letters a-v and digits 0-9. */
export async function eventKey(itemId:string):Promise<string>{return 'aur'+(await shaHex('event:'+itemId)).slice(0,35);}
/** Graph transactionId: deterministic UUID, not a calendar event ID. */
export async function transactionKey(itemId:string):Promise<string>{const h=await shaHex('event:'+itemId);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
export async function deliverOutbox(env:Env,row:OutboxRow,http:ProviderHTTP={fetch:globalThis.fetch},now=Date.now()):Promise<void>{
 const claim=await env.DB.prepare("UPDATE outbox SET locked_until=?,state='in_flight',attempt_count=attempt_count+1,updated_at=? WHERE id=? AND locked_until<=? AND state IN ('planned','retryable','unknown','in_flight')").bind(now+120000,now,row.id,now).run();
 if(Number(claim.meta?.changes??0)!==1)return;
 let startedWrite=false;
 try{
  const conn=await env.DB.prepare('SELECT * FROM connections WHERE id=?').bind(row.connection_id).first<Connection>();
  const item=await getItem(env.DB,row.item_id);
  if(!conn||!item||!['event','task'].includes(item.kind)||item.state!=='approved'||!(item.start_at||item.due_date))throw new Error('ACTION_NOT_OWNED_OR_NOT_APPROVED');
  const token=await validAccessToken(env,conn,http),impl=adapter(conn.provider,http);
  const cal=await impl.ensureCalendar(token,conn);
  if(!conn.calendar_id)await env.DB.prepare('UPDATE connections SET calendar_id=? WHERE id=? AND calendar_id IS NULL').bind(cal,conn.id).run();
  const allDay=item.kind==='task';const timeRef=allDay?`${item.due_date}T00:00:00`:item.start_at!;
  const pref=await env.DB.prepare('SELECT event_reminder_minutes,task_reminder_minutes FROM preferences WHERE id=1').first<{event_reminder_minutes:number;task_reminder_minutes:number}>();
  const lead=allDay?(pref?.task_reminder_minutes??1440):(pref?.event_reminder_minutes??120);
  const id=conn.provider==='gmail'?await eventKey(item.id):await transactionKey(item.id);
  const found=await impl.findOwnedEvent(token,cal,id,timeRef);
  if(found){await markCommitted(env,row,item,found.id,now);return;}
  // Unknown or in-flight results may already have succeeded remotely. Never auto-POST again.
  if(row.state==='unknown'||row.state==='in_flight'){
   await env.DB.prepare("UPDATE outbox SET state='blocked',last_error='REMOTE_RESULT_AMBIGUOUS_REVIEW_REQUIRED',locked_until=0,probe_count=probe_count+1,updated_at=? WHERE id=?").bind(now,row.id).run();
   return;
  }
  await reserveCalendarMutation(env.DB,now);
  startedWrite=true;
  const created=await impl.createEvent(token,cal,{id,title:allDay?`Prazo: ${item.title}`:item.title,startAt:allDay?item.due_date!:item.start_at!,description:'Criado pelo Aurora a partir de mensagem revisada. Confira a fonte original para detalhes.',remindMinutes:lead,allDay});
  await markCommitted(env,row,item,created.id,now);
 }catch(e){
  const code=errCode(e);
  const state=startedWrite?'unknown':code==='DAILY_CALENDAR_WRITE_CAP'?'retryable':'retryable';
  await env.DB.prepare('UPDATE outbox SET state=?,last_error=?,next_attempt_at=?,locked_until=0,updated_at=? WHERE id=?').bind(state,code,now+Math.min(3600000,30000*2**Math.min(row.attempt_count,6)),now,row.id).run();
  await incrementUsage(env.DB,'errors',now);
 }finally{
  await env.DB.prepare('UPDATE outbox SET locked_until=0 WHERE id=? AND locked_until=?').bind(row.id,now+120000).run();
 }
}
async function markCommitted(env:Env,row:OutboxRow,item:AcademicItem,remoteId:string,now:number):Promise<void>{
 if(!env.DB.batch)throw new Error('DB_ATOMIC_BATCH_REQUIRED');
 await env.DB.batch([
  env.DB.prepare("UPDATE outbox SET state='committed',remote_event_id=?,last_error=NULL,locked_until=0,updated_at=? WHERE id=?").bind(remoteId,now,row.id),
  env.DB.prepare("UPDATE academic_items SET state='synced',updated_at=? WHERE id=?").bind(now,item.id)
 ]);
}
/** Only an explicitly confirmed, already-owned calendar item can be changed. */
export async function queueCalendarChange(env:Env,itemId:string,input:{action:'update'|'cancel';start_at?:string;due_date?:string;title?:string},now=Date.now()):Promise<string>{
 const item=await getItem(env.DB,itemId);
 if(!item||item.state!=='synced'||!['event','task'].includes(item.kind))throw new Error('ITEM_NOT_SYNCED');
 const source=await env.DB.prepare("SELECT remote_event_id FROM outbox WHERE item_id=? AND action='create' AND state='committed'").bind(itemId).first<{remote_event_id:string}>();
 if(!source?.remote_event_id)throw new Error('REMOTE_ID_UNAVAILABLE');
 const active=await env.DB.prepare("SELECT id FROM calendar_changes WHERE item_id=? AND state!='committed'").bind(itemId).first();
 if(active)throw new Error('CHANGE_ALREADY_PENDING');
 const {action}=input;
 if(action==='update'&&!((item.kind==='event'&&input.start_at)|| (item.kind==='task'&&input.due_date)))throw new Error('MISSING_UPDATE_DATETIME');
 const id='chg_'+(await shaHex(`${item.id}:${action}:${now}:${crypto.randomUUID()}`)).slice(0,32);
 await env.DB.prepare(`INSERT INTO calendar_changes(id,item_id,connection_id,action,state,expected_remote_id,desired_start_at,desired_due_date,desired_title,created_at,updated_at)
 VALUES(?,?,?,?,'planned',?,?,?,?,?,?)`).bind(id,item.id,item.connection_id,action,source.remote_event_id,input.start_at??null,input.due_date??null,input.title??item.title,now,now).run();
 return id;
}
async function commitCalendarChange(env:Env,change:CalendarChange,now:number):Promise<void>{
 if(!env.DB.batch)throw new Error('DB_ATOMIC_BATCH_REQUIRED');
 const updateItem=change.action==='cancel'
  ?env.DB.prepare("UPDATE academic_items SET state='ignored',rationale='Cancelado manualmente na agenda pelo titular',updated_at=? WHERE id=? AND state='synced'").bind(now,change.item_id)
  :env.DB.prepare("UPDATE academic_items SET title=?,start_at=COALESCE(?,start_at),due_date=COALESCE(?,due_date),updated_at=? WHERE id=? AND state='synced'").bind(change.desired_title,change.desired_start_at,change.desired_due_date,now,change.item_id);
 await env.DB.batch([
  env.DB.prepare("UPDATE calendar_changes SET state='committed',locked_until=0,last_error=NULL,updated_at=? WHERE id=?").bind(now,change.id),updateItem
 ]);
}
export async function deliverCalendarChange(env:Env,change:CalendarChange,http:ProviderHTTP={fetch:globalThis.fetch},now=Date.now()):Promise<void>{
 const claimed=await env.DB.prepare("UPDATE calendar_changes SET state='in_flight',locked_until=?,attempt_count=attempt_count+1,updated_at=? WHERE id=? AND locked_until<=? AND state IN ('planned','retryable','unknown','in_flight')").bind(now+120000,now,change.id,now).run();
 if(Number(claimed.meta?.changes??0)!==1)return;
 let attemptedMutation=false;
 try{
  const conn=await env.DB.prepare('SELECT * FROM connections WHERE id=? AND enabled=1').bind(change.connection_id).first<Connection>();
  const item=await getItem(env.DB,change.item_id);
  if(!conn||!conn.calendar_id||!item||item.state!=='synced')throw new Error('OWNED_CONNECTION_OR_ITEM_MISSING');
  const token=await validAccessToken(env,conn,http),impl=adapter(conn.provider,http);
  const sourceKey=conn.provider==='gmail'?await eventKey(item.id):await transactionKey(item.id);
  const remote=await impl.readOwnedEvent(token,conn.calendar_id,change.expected_remote_id,sourceKey);
  // A previous DELETE may have been committed remotely before the response was lost.
  if(!remote){
   if(change.action==='cancel'&&(change.state==='unknown'||change.state==='in_flight')){await commitCalendarChange(env,change,now);return;}
   throw new Error('REMOTE_EVENT_MISSING_REVIEW_REQUIRED');
  }
  const desiredStart=item.kind==='task'?change.desired_due_date:change.desired_start_at;
  const desiredTitle=change.desired_title??item.title;
  if(change.action==='update'&&remote.title===desiredTitle&&remote.startAt===desiredStart){await commitCalendarChange(env,change,now);return;}
  // After an unknown response, never silently repeat a PATCH/DELETE.
  if(change.state==='unknown'||change.state==='in_flight'){
   await env.DB.prepare("UPDATE calendar_changes SET state='blocked',locked_until=0,last_error='REMOTE_RESULT_AMBIGUOUS_REVIEW_REQUIRED',updated_at=? WHERE id=?").bind(now,change.id).run();return;
  }
  await reserveCalendarMutation(env.DB,now);
  attemptedMutation=true;
  if(change.action==='cancel')await impl.deleteOwnedEvent(token,conn.calendar_id,remote.id);
  else{
   const pref=await env.DB.prepare('SELECT event_reminder_minutes,task_reminder_minutes FROM preferences WHERE id=1').first<{event_reminder_minutes:number;task_reminder_minutes:number}>();
   await impl.updateOwnedEvent(token,conn.calendar_id,remote.id,{title:desiredTitle,startAt:desiredStart!,allDay:item.kind==='task',remindMinutes:item.kind==='task'?(pref?.task_reminder_minutes??1440):(pref?.event_reminder_minutes??120)});
  }
  await commitCalendarChange(env,change,now);
 }catch(e){
  const code=errCode(e);
  const permanent=['REMOTE_EVENT_NOT_OWNED','REMOTE_EVENT_MISSING_REVIEW_REQUIRED','OWNED_CONNECTION_OR_ITEM_MISSING'].includes(code);
  await env.DB.prepare('UPDATE calendar_changes SET state=?,last_error=?,next_attempt_at=?,locked_until=0,updated_at=? WHERE id=?').bind(permanent?'blocked':attemptedMutation?'unknown':'retryable',code,now+Math.min(3600000,30000*2**Math.min(change.attempt_count,6)),now,change.id).run();
  await incrementUsage(env.DB,'errors',now);
 }finally{await env.DB.prepare('UPDATE calendar_changes SET locked_until=0 WHERE id=? AND locked_until=?').bind(change.id,now+120000).run();}
}
export async function runCycle(env:Env,http:ProviderHTTP={fetch:globalThis.fetch},now=Date.now()):Promise<void>{
 // Retention once per day instead of three DELETE scans every cron tick.
 // Never purge inbox/outbox/event ownership automatically without reconciliation.
 const last=await env.DB.prepare("SELECT value FROM runtime_state WHERE key='maintenance_last'").first<{value:number}>();
 if(!last){
  // Fresh installation cannot have expired rows; let the initial sync use the
  // tiny Free-tier SQL budget instead of performing five empty DELETE scans.
  await env.DB.prepare("INSERT INTO runtime_state(key,value) VALUES('maintenance_last',?) ON CONFLICT(key) DO NOTHING").bind(now).run();
 }else if(now-last.value>=86400000){
  await env.DB.prepare("UPDATE runtime_state SET value=? WHERE key='maintenance_last' AND value<?").bind(now,now-86400000).run();
  await env.DB.prepare('DELETE FROM oauth_pending WHERE expires_at<?').bind(now-86400000).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now-7*86400000).run();
  await env.DB.prepare('DELETE FROM auth_attempts WHERE last_at<?').bind(now-86400000).run();
  await env.DB.prepare('DELETE FROM audit WHERE at<?').bind(now-180*86400000).run();
  await env.DB.prepare('DELETE FROM usage_daily WHERE date_key<?').bind(new Date(now-90*86400000).toISOString().slice(0,10)).run();
  // Dedicated housekeeping tick: avoids mixing expensive DELETEs with OAuth,
  // synchronization and calendar writes under the 50-query Free-tier limit.
  return;
 }
 const network=meteredProviderHTTP(env,http,16,now);
 const all=await connections(env.DB);
 // Least recently synced account first prevents starvation across installations.
 for(const conn of all.filter(c=>c.enabled&&(c.next_sync_at??0)<=now).sort((a,b)=>(a.last_sync_at??0)-(b.last_sync_at??0)).slice(0,1))await syncConnection(env,conn,network,now);
 // Recover a crash between durable item storage and enqueue.
 const missing=(await env.DB.prepare("SELECT a.* FROM academic_items a LEFT JOIN outbox o ON o.item_id=a.id WHERE a.kind IN ('event','task') AND a.state='approved' AND o.id IS NULL LIMIT 10").all<AcademicItem>()).results;
 for(const item of missing)await queueEvent(env.DB,item,now);
 const out=await pendingOutbox(env.DB,now,1);
 const changes=(await env.DB.prepare("SELECT * FROM calendar_changes WHERE state IN ('planned','retryable','unknown','in_flight') AND next_attempt_at<=? AND locked_until<=? ORDER BY created_at LIMIT 1").bind(now,now).all<CalendarChange>()).results;
 // One remote mutation per tick, oldest first: changes cannot starve behind a busy inbox.
 if(out[0]&&(!changes[0]||out[0].created_at<=changes[0].created_at))await deliverOutbox(env,out[0],network,now);
 else if(changes[0])await deliverCalendarChange(env,changes[0],network,now);
}
