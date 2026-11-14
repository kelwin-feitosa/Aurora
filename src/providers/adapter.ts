import type {ProviderId,ProviderHTTP,RemoteMessage,SyncPage,Connection} from '../types.ts';
import type {MessageEnvelope} from '../domain/monitoring.ts';
export interface MailCalendarAdapter {
 readonly id:ProviderId;
 whoAmI(token:string):Promise<string>;
 listChanges(token:string,conn:Connection,limit:number):Promise<SyncPage>;
 /** Fetch headers only before potentially reading private message bodies. */
 fetchEnvelope(token:string,id:string):Promise<MessageEnvelope>;
 fetchMessage(token:string,id:string):Promise<RemoteMessage>;
 ensureCalendar(token:string,conn:Connection):Promise<string>;
 findOwnedEvent(token:string,calendarId:string,actionId:string,startAt:string):Promise<{id:string}|null>;
 /** Only events previously created by Aurora may be mutated. Missing events return null. */
 readOwnedEvent(token:string,calendarId:string,remoteId:string,sourceId:string):Promise<{id:string;title:string;startAt:string;allDay:boolean}|null>;
 updateOwnedEvent(token:string,calendarId:string,remoteId:string,event:{title:string;startAt:string;allDay:boolean;remindMinutes:number}):Promise<void>;
 deleteOwnedEvent(token:string,calendarId:string,remoteId:string):Promise<void>;
 createEvent(token:string,calendarId:string,event:{id:string;title:string;startAt:string;description:string;remindMinutes:number;allDay:boolean}):Promise<{id:string}>;
}
export type AdapterFactory=(provider:ProviderId,http:ProviderHTTP)=>MailCalendarAdapter;
