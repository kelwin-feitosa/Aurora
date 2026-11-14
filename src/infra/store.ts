import type {DB,Connection,InboxRow,AcademicDecision,AcademicItem,OutboxRow,ProviderId} from '../types.ts';
import {shaHex} from './crypto.ts';

export async function connections(db:DB):Promise<Connection[]> {return (await db.prepare('SELECT * FROM connections ORDER BY created_at').all<Connection>()).results;}
export async function getConnection(db:DB,id:string):Promise<Connection|null>{return db.prepare('SELECT * FROM connections WHERE id=?').bind(id).first<Connection>();}
export async function addConnection(db:DB,p:ProviderId,id:string,email:string,cipher:string,now:number):Promise<void>{
 await db.prepare('INSERT INTO connections(id,provider,account_hint,token_ciphertext,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,p,email,cipher,now,now).run();
}
export async function recordInbox(db:DB,conn:string,id:string,revision:string,now:number):Promise<void>{
 await db.prepare('INSERT OR IGNORE INTO inbox(connection_id,remote_id,remote_revision,received_at) VALUES(?,?,?,?)').bind(conn,id,revision,now).run();
}
export async function pendingInbox(db:DB,conn:string,now:number,limit:number):Promise<InboxRow[]>{
 return (await db.prepare("SELECT * FROM inbox WHERE connection_id=? AND state IN ('queued','retry') AND next_attempt_at<=? ORDER BY id LIMIT ?").bind(conn,now,limit).all<InboxRow>()).results;
}
export async function pendingOutbox(db:DB,now:number,limit:number):Promise<OutboxRow[]>{
 return (await db.prepare("SELECT * FROM outbox WHERE state IN ('planned','retryable','unknown','in_flight') AND next_attempt_at<=? AND locked_until<=? ORDER BY created_at LIMIT ?").bind(now,now,limit).all<OutboxRow>()).results;
}
export async function getItem(db:DB,id:string):Promise<AcademicItem|null>{return db.prepare('SELECT * FROM academic_items WHERE id=?').bind(id).first<AcademicItem>();}
export async function listItems(db:DB):Promise<AcademicItem[]> {return (await db.prepare('SELECT * FROM academic_items ORDER BY created_at DESC LIMIT 100').all<AcademicItem>()).results;}
export async function inboxItem(db:DB,inboxId:number):Promise<AcademicItem|null>{return db.prepare('SELECT * FROM academic_items WHERE inbox_id=?').bind(inboxId).first<AcademicItem>();}
export async function saveDecision(db:DB,row:InboxRow,decision:AcademicDecision,now:number):Promise<AcademicItem>{
 const id='item_'+(await shaHex(`${row.connection_id}:${row.remote_id}:${row.remote_revision}`)).slice(0,32);
 const normalizedTitle=decision.title.normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
 const fingerprint=(decision.kind==='event'||decision.kind==='task')&&decision.confidence==='explicit'?
  (await shaHex(`${decision.kind}:${normalizedTitle}:${decision.start_at??decision.due_date??''}`)).slice(0,36):null;
 if(fingerprint&&decision.state==='approved'){
  const similar=await db.prepare('SELECT id FROM academic_items WHERE connection_id=? AND fingerprint=? LIMIT 1').bind(row.connection_id,fingerprint).first<{id:string}>();
  if(similar)decision={...decision,kind:'review',state:'review',confidence:'ambiguous',rationale:'Possível comunicado repetido para o mesmo compromisso. Confirme antes de criar outro evento.'};
 }
 await db.prepare(`INSERT OR IGNORE INTO academic_items
 (id,connection_id,inbox_id,kind,title,details,start_at,due_date,time_zone,confidence,source_excerpt,rationale,state,created_at,updated_at,fingerprint)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,row.connection_id,row.id,decision.kind,decision.title,decision.details,decision.start_at,decision.due_date,'America/Sao_Paulo',decision.confidence,'',decision.rationale,decision.state,now,now,fingerprint).run();
 const item=await inboxItem(db,row.id);if(!item)throw new Error('Failed to store decision');
 return item;
}
/** One original inbox record plus closed synthetic segment records.
 * Workaround for the existing UNIQUE(inbox_id) contract without rebuilding the
 * live D1 table and endangering foreign-key references. Synthetic rows are
 * permanently done, are never fetched as provider IDs, and preserve source IDs.
 */
export async function saveDecisions(db:DB,row:InboxRow,decisions:AcademicDecision[],now:number):Promise<AcademicItem[]>{
 if(!decisions.length||decisions.length>3)throw new Error('INVALID_DECISION_BATCH');
 const out:AcademicItem[]=[];
 for(let idx=0;idx<decisions.length;idx++){
  if(idx===0){out.push(await saveDecision(db,row,decisions[idx]!,now));continue;}
  const remoteId=`${row.remote_id}:aurora-part-${idx+1}`;
  await db.prepare("INSERT OR IGNORE INTO inbox(connection_id,remote_id,remote_revision,state,received_at) VALUES(?,?,?,'done',?)").bind(row.connection_id,remoteId,row.remote_revision,now).run();
  const segment=await db.prepare('SELECT * FROM inbox WHERE connection_id=? AND remote_id=? AND remote_revision=?').bind(row.connection_id,remoteId,row.remote_revision).first<InboxRow>();
  if(!segment)throw new Error('SEGMENT_INSERT_FAILED');
  out.push(await saveDecision(db,segment,decisions[idx]!,now));
 }
 return out;
}
export async function queueEvent(db:DB,item:AcademicItem,now:number):Promise<void>{
 if((item.kind!=='event'&&item.kind!=='task')||item.state!=='approved'||!(item.start_at||item.due_date)) return;
 const id='act_'+(await shaHex(`${item.id}:create`)).slice(0,32);
 await db.prepare("INSERT OR IGNORE INTO outbox(id,item_id,connection_id,action,state,created_at,updated_at) VALUES(?,?,?,'create','planned',?,?)").bind(id,item.id,item.connection_id,now,now).run();
}
export async function incrementUsage(db:DB,kind:'mail_reads'|'calendar_writes'|'errors'|'provider_calls',now:number):Promise<void>{
 const date=new Date(now).toISOString().slice(0,10);
 // allowlist column names
 await db.prepare(`INSERT INTO usage_daily(date_key,${kind},updated_at) VALUES(?,1,?) ON CONFLICT(date_key) DO UPDATE SET ${kind}=${kind}+1,updated_at=excluded.updated_at`).bind(date,now).run();
}
export async function dailyUsage(db:DB,now:number):Promise<{mail_reads:number;calendar_writes:number;errors:number;provider_calls:number}>{
 return await db.prepare('SELECT mail_reads,calendar_writes,errors,provider_calls FROM usage_daily WHERE date_key=?').bind(new Date(now).toISOString().slice(0,10)).first<{mail_reads:number;calendar_writes:number;errors:number;provider_calls:number}>()||{mail_reads:0,calendar_writes:0,errors:0,provider_calls:0};
}
export async function audit(db:DB,code:string,detail:string,now=Date.now()):Promise<void>{
 await db.prepare('INSERT INTO audit(at,action,detail_code) VALUES(?,?,?)').bind(now,code,detail.slice(0,100)).run();
}

/** Reserve budget before a provider call, so failed/timeout calls are counted. */
export async function reserveProviderCall(db:DB,now:number,limit=500):Promise<void>{
 const date=new Date(now).toISOString().slice(0,10);
 const r=await db.prepare(`INSERT INTO usage_daily(date_key,provider_calls,updated_at) VALUES(?,1,?)
 ON CONFLICT(date_key) DO UPDATE SET provider_calls=provider_calls+1,updated_at=excluded.updated_at
 WHERE provider_calls<?`).bind(date,now,limit).run();
 if(Number(r.meta?.changes??0)!==1)throw new Error('DAILY_PROVIDER_CALL_CAP');
}

/** Atomic reservation counts ATTEMPTED remote mutations, even when the network
 * fails after committing. A read-then-write counter is race-prone. */
export async function reserveCalendarMutation(db:DB,now:number,limit=30):Promise<void>{
 const day=new Date(now).toISOString().slice(0,10);
 const result=await db.prepare(`INSERT INTO usage_daily(date_key,calendar_writes,updated_at) VALUES(?,1,?)
 ON CONFLICT(date_key) DO UPDATE SET calendar_writes=calendar_writes+1,updated_at=excluded.updated_at
 WHERE calendar_writes<?`).bind(day,now,limit).run();
 if(Number(result.meta?.changes??0)!==1)throw new Error('DAILY_CALENDAR_WRITE_CAP');
}
