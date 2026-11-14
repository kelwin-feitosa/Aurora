import type {Connection,ProviderHTTP,RemoteMessage,SyncPage} from '../types.ts';
import type {MailCalendarAdapter} from './adapter.ts';
import {apiJson,ApiError,asText,stripMarkup} from './http.ts';

const MAIL='https://gmail.googleapis.com/gmail/v1/users/me';
const CAL='https://www.googleapis.com/calendar/v3';
interface GmailMessage {id:string;threadId?:string;historyId?:string;internalDate?:string;payload?:{mimeType?:string;filename?:string;headers?:{name:string;value:string}[];body?:{data?:string;attachmentId?:string;size?:number};parts?:GmailMessage['payload'][]};}
function decodeBody(s:string):string{
 if(s.length>128000) return '';
 try {const b=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)); const bytes=Uint8Array.from(b,c=>c.charCodeAt(0));return new TextDecoder('utf-8',{fatal:false}).decode(bytes).slice(0,14000);}catch{return '';}
}
function extractParts(payload:GmailMessage['payload']):{text:string;incomplete:boolean}{
 let plain='',html='',seen=0,incomplete=false;
 const visit=(p:GmailMessage['payload'],depth:number)=>{
  if(!p)return;
  if(depth>8||seen>=64){incomplete=true;return;}
  seen++;
  if(p.body?.data){
   if(p.body.data.length>18000)incomplete=true; // 14 KiB of text may be truncated.
   const text=decodeBody(p.body.data);
   if(p.mimeType==='text/plain')plain ||=text;
   else if(p.mimeType==='text/html')html ||=text;
  }
  if((p.parts?.length??0)>20)incomplete=true;
  for(const part of (p.parts??[]).slice(0,20))visit(part,depth+1);
 };visit(payload,0);
 return {text:asText(plain||stripMarkup(html)),incomplete};
}
function encodeContinuation(page:string|null):string|null{return page?`pg:${page}`:null;}
function decodeContinuation(page:string|null):string|null{return page?.startsWith('pg:')?page.slice(3):null;}
export class GmailAdapter implements MailCalendarAdapter{
 readonly id='gmail';private http:ProviderHTTP;constructor(http:ProviderHTTP){this.http=http;}
 async whoAmI(token:string):Promise<string>{const r=await apiJson<{emailAddress:string}>(this.http,`${MAIL}/profile`,token);return r.emailAddress;}
 async listChanges(token:string,conn:Connection,limit:number):Promise<SyncPage>{
  const max=Math.max(1,Math.min(10,limit));
  if(conn.sync_mode==='bootstrap'){
   let anchor=conn.sync_anchor;
   if(!anchor){const profile=await apiJson<{historyId:string}>(this.http,`${MAIL}/profile`,token);anchor=profile.historyId;}
   const u=new URL(`${MAIL}/messages`);u.searchParams.set('maxResults',String(max));u.searchParams.set('q','newer_than:30d');
   const page=decodeContinuation(conn.sync_page);if(page)u.searchParams.set('pageToken',page);
   const r=await apiJson<{messages?:{id:string}[];nextPageToken?:string}>(this.http,u.toString(),token);
   return {messages:(r.messages??[]).map(x=>({id:x.id,revision:'0'})),nextPage:encodeContinuation(r.nextPageToken??null),nextCursor:r.nextPageToken?null:anchor,anchor};
  }
  const u=new URL(`${MAIL}/history`);if(!conn.sync_cursor)throw new Error('GMAIL_MISSING_CURSOR');
  u.searchParams.set('startHistoryId',conn.sync_cursor);u.searchParams.set('historyTypes','messageAdded');u.searchParams.set('maxResults',String(max));
  const page=decodeContinuation(conn.sync_page);if(page)u.searchParams.set('pageToken',page);
  let r:{history?:{messagesAdded?:{message:{id:string}}[]}[];nextPageToken?:string;historyId:string};
  try{r=await apiJson(this.http,u.toString(),token);}catch(e){if(e instanceof ApiError&&e.status===404)throw new ApiError(404,'GMAIL_CURSOR_EXPIRED');throw e;}
  const ids=new Set<string>();for(const h of r.history??[])for(const a of h.messagesAdded??[])ids.add(a.message.id);
  if(ids.size>30)throw new Error('GMAIL_BATCH_TOO_LARGE_REQUIRES_SMALLER_PAGE');
  return {messages:[...ids].map(id=>({id,revision:'0'})),nextPage:encodeContinuation(r.nextPageToken??null),nextCursor:r.nextPageToken?null:r.historyId};
 }
 async fetchEnvelope(token:string,id:string):Promise<import('../domain/monitoring.ts').MessageEnvelope>{
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(id))throw new Error('GMAIL_INVALID_ID');
  const u=new URL(`${MAIL}/messages/${encodeURIComponent(id)}`);
  u.searchParams.set('format','metadata');u.searchParams.append('metadataHeaders','Subject');u.searchParams.append('metadataHeaders','From');
  const r=await apiJson<GmailMessage>(this.http,u.toString(),token);
  const headers=r.payload?.headers??[];
  const get=(name:string)=>headers.find(h=>h.name.toLowerCase()===name)?.value??'';
  const at=Number(r.internalDate);
  return {id,subject:get('subject').slice(0,400),sender:get('from').slice(0,320),receivedAt:Number.isFinite(at)&&at>0?new Date(at).toISOString():new Date(0).toISOString()};
 }
 async fetchMessage(token:string,id:string):Promise<RemoteMessage>{
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error('GMAIL_INVALID_ID');
  const r=await apiJson<GmailMessage>(this.http,`${MAIL}/messages/${encodeURIComponent(id)}?format=full`,token);
  const headers=r.payload?.headers??[];
  const header=(name:string)=>headers.find(h=>h.name.toLowerCase()===name)?.value??'';
  const invitations:string[]=[];
  const candidates:Array<{data?:string;attachmentId?:string;size?:number}>=[];
  const walk=(p:GmailMessage['payload'],depth:number)=>{
   if(!p||depth>5||candidates.length>=2)return;
   if(p.mimeType?.toLowerCase()==='text/calendar'||/\.ics$/i.test(p.filename??''))candidates.push(p.body??{});
   for(const child of (p.parts??[]).slice(0,12))walk(child,depth+1);
  };
  walk(r.payload,0);
  for(const invite of candidates){
   if((invite.size??0)>24*1024){invitations.push('CONVITE_EXCEDE_LIMITE');continue;}
   if(invite.data){invitations.push(decodeBody(invite.data));continue;}
   if(invite.attachmentId&&/^[A-Za-z0-9_-]{1,300}$/.test(invite.attachmentId)){
    const attachment=await apiJson<{data?:string;size?:number}>(this.http,`${MAIL}/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(invite.attachmentId)}`,token);
    invitations.push((attachment.size??0)>24*1024?'CONVITE_EXCEDE_LIMITE':decodeBody(attachment.data??''));
   }else invitations.push('CONVITE_SEM_CONTEUDO');
  }
  const extracted=extractParts(r.payload);
  return {id:r.id,revision:'0',subject:header('subject').slice(0,400),sender:header('from').slice(0,200),body:extracted.text,textIncomplete:extracted.incomplete,receivedAt:new Date(Number(r.internalDate??Date.now())).toISOString(),threadId:r.threadId,calendarText:invitations};
 }
 async ensureCalendar(token:string,conn:Connection):Promise<string>{
  if(conn.calendar_id)return conn.calendar_id;
  const calendarName=`Aurora • ${conn.id.slice(0,8)}`;
  let page:string|null=null;
  for(let i=0;i<10;i++){
   const url=new URL(`${CAL}/users/me/calendarList`);url.searchParams.set('maxResults','100');if(page)url.searchParams.set('pageToken',page);
   const r: {items?:{id:string;summary:string}[];nextPageToken?:string}=await apiJson(this.http,url.toString(),token);
   const found=r.items?.find(x=>x.summary===calendarName);if(found)return found.id;
   page=r.nextPageToken??null;if(!page)break;
   if(i===9)throw new Error('CALENDAR_LIST_TOO_LARGE_REVIEW');
  }
  const created=await apiJson<{id:string}>(this.http,`${CAL}/calendars`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({summary:calendarName,timeZone:'America/Sao_Paulo'})});return created.id;
 }
 async findOwnedEvent(token:string,calendarId:string,actionId:string,_startAt:string):Promise<{id:string}|null>{
  const eventId=actionId;
  // A predictable event ID alone does not prove ownership. Never mark an
  // unrelated calendar entry as committed, even if its ID happens to match.
  type Event={id:string;extendedProperties?:{private?:{aurora?:string;source_id?:string}}};
  try{
   const result=await apiJson<Event>(this.http,`${CAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,token);
   if(result.id!==eventId||result.extendedProperties?.private?.aurora!=='1'||result.extendedProperties.private.source_id!==eventId)
    throw new Error('REMOTE_EVENT_NOT_OWNED');
   return {id:result.id};
  }catch(e){if(e instanceof ApiError&&e.status===404)return null;throw e;}
 }
 async readOwnedEvent(token:string,calendarId:string,remoteId:string,sourceId:string):Promise<{id:string;title:string;startAt:string;allDay:boolean}|null>{
  type Event={id:string;summary?:string;start?:{date?:string;dateTime?:string};extendedProperties?:{private?:{aurora?:string;source_id?:string}}};
  let r:Event;
  try{r=await apiJson<Event>(this.http,`${CAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(remoteId)}`,token);}
  catch(e){if(e instanceof ApiError&&e.status===404)return null;throw e;}
  if(r.id!==remoteId||r.extendedProperties?.private?.aurora!=='1'||r.extendedProperties.private.source_id!==sourceId)throw new Error('REMOTE_EVENT_NOT_OWNED');
  return {id:r.id,title:r.summary??'',startAt:r.start?.date??r.start?.dateTime?.slice(0,19)??'',allDay:Boolean(r.start?.date)};
 }
 async updateOwnedEvent(token:string,calendarId:string,remoteId:string,event:{title:string;startAt:string;allDay:boolean;remindMinutes:number}):Promise<void>{
  const start=event.allDay?{date:event.startAt}:{dateTime:`${event.startAt}-03:00`,timeZone:'America/Sao_Paulo'};
  const end=event.allDay?{date:new Date(Date.parse(event.startAt+'T00:00:00Z')+86400000).toISOString().slice(0,10)}:{dateTime:new Date(Date.parse(event.startAt+'-03:00')+3600000).toISOString(),timeZone:'America/Sao_Paulo'};
  await apiJson(this.http,`${CAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(remoteId)}`,token,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({summary:event.title,start,end,reminders:{useDefault:false,overrides:[{method:'popup',minutes:event.remindMinutes}]}})});
 }
 async deleteOwnedEvent(token:string,calendarId:string,remoteId:string):Promise<void>{
  await apiJson(this.http,`${CAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(remoteId)}`,token,{method:'DELETE'});
 }
 async createEvent(token:string,calendarId:string,event:{id:string;title:string;startAt:string;description:string;remindMinutes:number;allDay:boolean}):Promise<{id:string}>{
  let start:Record<string,string>,end:Record<string,string>;
  if(event.allDay){
    if(!/^20\d{2}-\d{2}-\d{2}$/.test(event.startAt))throw new Error('INVALID_ALLDAY_DATE');
    const next=new Date(Date.parse(event.startAt+'T00:00:00Z')+86400000).toISOString().slice(0,10);
    start={date:event.startAt};end={date:next};
  }else{
    const beginning=new Date(`${event.startAt}-03:00`);if(!Number.isFinite(beginning.getTime()))throw new Error('INVALID_DATE');
    start={dateTime:`${event.startAt}-03:00`,timeZone:'America/Sao_Paulo'};
    end={dateTime:new Date(beginning.getTime()+3600000).toISOString(),timeZone:'America/Sao_Paulo'};
  }
  const payload={id:event.id,summary:event.title,description:event.description,start,end,reminders:{useDefault:false,overrides:[{method:'popup',minutes:event.remindMinutes}]},extendedProperties:{private:{aurora:'1',source_id:event.id}}};
  return apiJson<{id:string}>(this.http,`${CAL}/calendars/${encodeURIComponent(calendarId)}/events`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 }
}
