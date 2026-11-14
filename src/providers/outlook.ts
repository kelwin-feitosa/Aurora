import type {Connection,ProviderHTTP,RemoteMessage,SyncPage} from '../types.ts';
import type {MailCalendarAdapter} from './adapter.ts';
import {apiJson,ApiError,asText,stripMarkup,safeGraphUrl} from './http.ts';
const ROOT='https://graph.microsoft.com/v1.0';
const MAIL=`${ROOT}/me/mailFolders/inbox/messages/delta`;
const H={'Prefer':'IdType="ImmutableId"'};
interface GraphMsg {id:string;subject?:string;body?:{content?:string;contentType?:string};bodyPreview?:string;hasAttachments?:boolean;receivedDateTime?:string;internetMessageId?:string;from?:{emailAddress?:{address?:string}};'@removed'?:unknown}
export class OutlookAdapter implements MailCalendarAdapter{
 readonly id='outlook';private http:ProviderHTTP;constructor(http:ProviderHTTP){this.http=http;}
 async whoAmI(token:string):Promise<string>{const r=await apiJson<{mail?:string;userPrincipalName?:string}>(this.http,`${ROOT}/me?$select=mail,userPrincipalName`,token);return r.mail||r.userPrincipalName||'Conta Outlook';}
 async listChanges(token:string,conn:Connection,limit:number):Promise<SyncPage>{
  const first=new URL(MAIL);first.searchParams.set('$select','id,subject,receivedDateTime');first.searchParams.set('$top',String(Math.max(1,Math.min(limit,10))));
  if(!conn.sync_cursor&&!conn.sync_page)first.searchParams.set('$filter',`receivedDateTime ge ${new Date(Date.now()-30*86400000).toISOString()}`);
  const url=conn.sync_page? safeGraphUrl(conn.sync_page):conn.sync_cursor? safeGraphUrl(conn.sync_cursor):first.toString();
  let r:{value:GraphMsg[];'@odata.nextLink'?:string;'@odata.deltaLink'?:string};
  try{r=await apiJson(this.http,url,token,{headers:H});}
  catch(e){if(e instanceof ApiError&&e.status===410)throw new ApiError(410,'GRAPH_DELTA_EXPIRED');throw e;}
  const nextPage=r['@odata.nextLink']?safeGraphUrl(r['@odata.nextLink']):null;
  const nextCursor=r['@odata.deltaLink']?safeGraphUrl(r['@odata.deltaLink']):null;
  if(!nextPage&&!nextCursor)throw new Error('GRAPH_MISSING_DELTA_CHECKPOINT');
  return {messages:(r.value??[]).filter(x=>!x['@removed']).map(x=>({id:x.id,revision:'0'})),nextPage,nextCursor,anchor:null};
 }
 async fetchEnvelope(token:string,id:string):Promise<import('../domain/monitoring.ts').MessageEnvelope>{
  if(id.length>400||!id||/[\r\n]/.test(id))throw new Error('GRAPH_INVALID_ID');
  const url=`${ROOT}/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,receivedDateTime`;
  const r=await apiJson<GraphMsg>(this.http,url,token,{headers:H});
  return {id,subject:(r.subject??'').slice(0,400),sender:(r.from?.emailAddress?.address??'').slice(0,320),receivedAt:r.receivedDateTime??new Date(0).toISOString()};
 }
 async fetchMessage(token:string,id:string):Promise<RemoteMessage>{
  if(id.length>400||!id||/[\r\n]/.test(id))throw new Error('GRAPH_INVALID_ID');
  const url=`${ROOT}/me/messages/${encodeURIComponent(id)}?$select=id,subject,body,bodyPreview,hasAttachments,receivedDateTime,internetMessageId,from`;
  const r=await apiJson<GraphMsg>(this.http,url,token,{headers:H});
  const fullBody=r.body?.content??r.bodyPreview??'';
  const body=r.body?.contentType==='html'?stripMarkup(fullBody):asText(fullBody);
  const textIncomplete=fullBody.length>14000;
  const invites:string[]=[];
  if(r.hasAttachments){
   const response=await apiJson<{value?:Array<{name?:string;contentType?:string;size?:number;contentBytes?:string;'@odata.type'?:string}>}>(this.http,`${ROOT}/me/messages/${encodeURIComponent(id)}/attachments?$top=10`,token,{headers:H});
   for(const a of (response.value??[])){
    if(invites.length>=2)break;
    if(a.contentType?.toLowerCase()!=='text/calendar'&&!/\.ics$/i.test(a.name??''))continue;
    if((a.size??0)>24*1024||!a.contentBytes||a.contentBytes.length>35_000){invites.push('CONVITE_ANEXO_NAO_SUPORTADO');continue;}
    try{const decoded=atob(a.contentBytes.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-a.contentBytes.length%4)%4));
     invites.push(new TextDecoder().decode(Uint8Array.from(decoded,c=>c.charCodeAt(0))).slice(0,24*1024));
    }catch{invites.push('CONVITE_ANEXO_INVALIDO');}
   }
  }
  return {id:r.id,revision:'0',subject:(r.subject??'').slice(0,400),body,textIncomplete,sender:(r.from?.emailAddress?.address??'').slice(0,320),receivedAt:r.receivedDateTime??new Date().toISOString(),calendarText:invites};
 }
 async ensureCalendar(token:string,conn:Connection):Promise<string>{
  if(conn.calendar_id)return conn.calendar_id;
  const calendarName=`Aurora • ${conn.id.slice(0,8)}`;
  let url=`${ROOT}/me/calendars?$select=id,name&$top=100`;
  for(let i=0;i<10;i++){
   const r=await apiJson<{value:{id:string;name:string}[];'@odata.nextLink'?:string}>(this.http,url,token);
   const found=r.value?.find(x=>x.name===calendarName);if(found)return found.id;
   const next=r['@odata.nextLink'];if(!next)break;
   const parsed=new URL(next);
   if(parsed.protocol!=='https:'||parsed.hostname!=='graph.microsoft.com'||parsed.port||parsed.username||parsed.password||parsed.hash||parsed.pathname!=='/v1.0/me/calendars')
    throw new Error('GRAPH_CALENDAR_NEXTLINK_BLOCKED');
   if(i===9)throw new Error('CALENDAR_LIST_TOO_LARGE_REVIEW');url=parsed.toString();
  }
  const result=await apiJson<{id:string}>(this.http,`${ROOT}/me/calendars`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:calendarName})});
  return result.id;
 }
 async findOwnedEvent(token:string,calendarId:string,actionId:string,startAt:string):Promise<{id:string}|null>{
  // Never treat a title match as proof. Match the stable transactionId exactly.
  const center=Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(startAt)?`${startAt}T12:00:00-03:00`:`${startAt}-03:00`);if(!Number.isFinite(center))throw new Error('INVALID_DATE');
  const from=new Date(center-86400000).toISOString(),to=new Date(center+86400000).toISOString();
  let url=`${ROOT}/me/calendars/${encodeURIComponent(calendarId)}/calendarView?startDateTime=${encodeURIComponent(from)}&endDateTime=${encodeURIComponent(to)}&$top=50&$select=id,transactionId,start,subject`;
  for(let page=0;page<5;page++){
   const r=await apiJson<{value:{id:string;transactionId?:string}[];'@odata.nextLink'?:string}>(this.http,url,token,{headers:H});
   const found=r.value.find(e=>e.transactionId===actionId);if(found)return {id:found.id};
   if(!r['@odata.nextLink'])break;
   const next=new URL(r['@odata.nextLink']);
   const expectedPath=`/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView`;
   if(next.protocol!=='https:'||next.hostname!=='graph.microsoft.com'||next.port||next.username||next.password||next.hash||next.pathname!==expectedPath)
    throw new Error('GRAPH_CALENDAR_NEXTLINK_BLOCKED');
   // A bounded search must fail closed when the final page still points ahead;
   // otherwise a later POST could duplicate a real event beyond our search window.
   if(page===4)throw new Error('GRAPH_EVENT_RECONCILIATION_INCOMPLETE');
   url=next.toString();
  }
  return null;
 }
 async readOwnedEvent(token:string,calendarId:string,remoteId:string,sourceId:string):Promise<{id:string;title:string;startAt:string;allDay:boolean}|null>{
  type Event={id:string;subject?:string;transactionId?:string;isAllDay?:boolean;start?:{dateTime?:string}};
  let r:Event;
  try{r=await apiJson<Event>(this.http,`${ROOT}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(remoteId)}?$select=id,subject,transactionId,isAllDay,start`,token,{headers:H});}
  catch(e){if(e instanceof ApiError&&e.status===404)return null;throw e;}
  if(r.id!==remoteId||r.transactionId!==sourceId)throw new Error('REMOTE_EVENT_NOT_OWNED');
  return {id:r.id,title:r.subject??'',startAt:r.start?.dateTime?.slice(0,r.isAllDay?10:19)??'',allDay:Boolean(r.isAllDay)};
 }
 async updateOwnedEvent(token:string,calendarId:string,remoteId:string,event:{title:string;startAt:string;allDay:boolean;remindMinutes:number}):Promise<void>{
  const start=event.allDay?`${event.startAt}T00:00:00`:event.startAt;
  const end=new Date(Date.parse(start+'Z')+(event.allDay?86400000:3600000)).toISOString().slice(0,19);
  await apiJson(this.http,`${ROOT}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(remoteId)}`,token,{method:'PATCH',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify({subject:event.title,start:{dateTime:start,timeZone:'E. South America Standard Time'},end:{dateTime:end,timeZone:'E. South America Standard Time'},isAllDay:event.allDay,isReminderOn:true,reminderMinutesBeforeStart:event.remindMinutes})});
 }
 async deleteOwnedEvent(token:string,calendarId:string,remoteId:string):Promise<void>{
  await apiJson(this.http,`${ROOT}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(remoteId)}`,token,{method:'DELETE',headers:H});
 }
 async createEvent(token:string,calendarId:string,event:{id:string;title:string;startAt:string;description:string;remindMinutes:number;allDay:boolean}):Promise<{id:string}>{
  const dateText=event.allDay?`${event.startAt}T00:00:00`:event.startAt;
  const base=new Date(`${dateText}-03:00`);if(!Number.isFinite(base.getTime()))throw new Error('INVALID_DATE');
  // Graph expects local clock string paired with Exchange timezone, not UTC text.
  const increment=event.allDay?86400000:3600000;
  const end=new Date(Date.parse(`${dateText}Z`)+increment);
  const payload={transactionId:event.id,subject:event.title,body:{contentType:'text',content:event.description},start:{dateTime:dateText,timeZone:'E. South America Standard Time'},end:{dateTime:end.toISOString().slice(0,19),timeZone:'E. South America Standard Time'},isAllDay:event.allDay,isReminderOn:true,reminderMinutesBeforeStart:event.remindMinutes};
  return apiJson<{id:string}>(this.http,`${ROOT}/me/calendars/${encodeURIComponent(calendarId)}/events`,token,{method:'POST',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 }
}
