import type {AcademicDecision} from '../types.ts';

/** Strict, dependency-free RFC 5545 *subset*, not an iCalendar import engine.
 * Calendar invites are untrusted proposals: they are NEVER auto-published.
 * Recurrences, floating times, unknown zones and malformed content are review-only.
 */
const MAX_BYTES=24*1024, MAX_LINES=320, MAX_EVENTS=3;
const TZ='America/Sao_Paulo';
const safe=(s:string,n=140)=>s.replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
function validDate(s:string):boolean {
 if(!/^20\d\d-\d\d-\d\d$/.test(s))return false;
 const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function utcToLocal(utc:string):string|null {
 const date=new Date(utc);if(!Number.isFinite(date.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const v=(name:string)=>parts.find(x=>x.type===name)?.value??'';
 return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:00`;
}
function parseDate(value:string,params:string):{start:string|null;date:string|null;problem:string|null}{
 const allDay=/VALUE=DATE(?:;|$)/i.test(params)||/^\d{8}$/.test(value);
 if(allDay&&/^20\d{6}$/.test(value)){const d=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;return {start:null,date:validDate(d)?d:null,problem:validDate(d)?'Evento de dia inteiro: confirmar antes de importar':'Data inválida'};}
 if(!/^20\d{6}T(?:[01]\d|2[0-3])[0-5]\d(?:[0-5]\d)?Z?$/.test(value))return {start:null,date:null,problem:'Data/hora de convite não suportada'};
 const d=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
 if(!validDate(d))return {start:null,date:null,problem:'Data inválida'};
 const clock=`${value.slice(9,11)}:${value.slice(11,13)}:00`;
 if(value.endsWith('Z')){
  const iso=`${d}T${value.slice(9,11)}:${value.slice(11,13)}:${value.length>=16?value.slice(13,15):'00'}Z`;
  const local=utcToLocal(iso);return {start:local,date:local?.slice(0,10)??null,problem:local?null:'Data UTC inválida'};
 }
 if(/TZID=America\/Sao_Paulo(?:;|$)/i.test(params))return {start:`${d}T${clock}`,date:d,problem:null};
 return {start:null,date:d,problem:'Horário sem fuso ou com fuso não suportado; confirmar manualmente'};
}
function review(title:string,rationale:string,start:string|null=null,date:string|null=null):AcademicDecision {
 return {kind:'review',state:'review',confidence:'ambiguous',title:safe(title)||'Convite de calendário',details:'Convite externo: confirme os dados antes de criar ou alterar compromissos.',start_at:start,due_date:date,source_excerpt:'',rationale:rationale.slice(0,350)};
}
export function parseCalendarInvites(ics:string):AcademicDecision[] {
 if(typeof ics!=='string'||ics.length>MAX_BYTES)return [review('Convite de calendário','Arquivo iCalendar excessivamente grande ou inválido: não foi processado')];
 if(/\u0000/.test(ics))return [review('Convite de calendário','Arquivo com bytes nulos: revisão necessária')];
 const physical=ics.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
 if(physical.length>MAX_LINES)return [review('Convite de calendário','Número de linhas excede limite de segurança')];
 const lines:string[]=[];
 for(const line of physical){if(line.length>2000)return [review('Convite de calendário','Linha iCalendar longa demais')];if(/^[ \t]/.test(line)&&lines.length)lines[lines.length-1]+=line.slice(1);else lines.push(line);}
 if(!lines.includes('BEGIN:VCALENDAR')||!lines.includes('END:VCALENDAR'))return [review('Convite de calendário','Estrutura VCALENDAR ausente ou incompleta')];
 let method='PUBLISH',inEvent=false,nested=0,duplicateCritical=false,current:Record<string,{value:string;params:string}>={},count=0;const events:AcademicDecision[]=[];
 for(const line of lines){
  if(line==='BEGIN:VEVENT'){if(inEvent)return [review('Convite de calendário','Componentes aninhados não suportados')];inEvent=true;nested=0;duplicateCritical=false;current={};count++;if(count>MAX_EVENTS)return [review('Convite de calendário','Mais de três eventos no arquivo: revisão manual obrigatória')];continue;}
  if(line==='END:VEVENT'){
   if(!inEvent)return [review('Convite de calendário','VEVENT malformado')];inEvent=false;
   const title=safe(current.SUMMARY?.value??'Convite sem título');
   const changes=method==='CANCEL'||current.STATUS?.value==='CANCELLED';
   const recurring=Boolean(current.RRULE||current.RDATE||current.EXDATE||current['RECURRENCE-ID']);
   const uid=current.UID?.value;
   const parsed=current.DTSTART?parseDate(current.DTSTART.value,current.DTSTART.params):{start:null,date:null,problem:'DTSTART ausente'};
   let rationale=changes?'Pedido de cancelamento: selecione e confirme o evento original; nenhuma ação automática':
     recurring?'Recorrência ou exceção não suportada: revisar todas as ocorrências manualmente':
     parsed.problem??'Convite com data explícita: confirme remetente e horário antes de adicionar ao calendário';
   if(!uid||uid.length>300)rationale+='; UID ausente ou inválido';
   if(duplicateCritical){rationale+='; propriedades de calendário repetidas e ambíguas';parsed.start=null;parsed.date=null;}
   if(current.SEQUENCE&&!/^\d{1,8}$/.test(current.SEQUENCE.value))rationale+='; SEQUENCE inválido';
   // Treat cancellations/updates and unknown recurrence as manual, never invent a replacement date.
   events.push(review(title,rationale,changes||recurring?null:parsed.start,changes||recurring?null:parsed.date));
   continue;
  }
  if(inEvent){
   // Never let nested VALARM properties override event date or title.
   if(/^BEGIN:/i.test(line)){nested++;continue;}
   if(/^END:/i.test(line)){nested=Math.max(0,nested-1);continue;}
   if(nested||line.startsWith('ATTACH;'))continue;
   const colon=line.indexOf(':');if(colon<1)continue;const key=line.slice(0,colon).split(';')[0]?.toUpperCase()??'';
   if(!/^[A-Z][A-Z0-9-]{0,30}$/.test(key))continue;
   // Critical duplicates are ambiguous even if one looks plausible.
   if(Object.hasOwn(current,key)&&['DTSTART','UID','SUMMARY','SEQUENCE'].includes(key))duplicateCritical=true;
   if(!Object.hasOwn(current,key))current[key]={value:line.slice(colon+1),params:line.slice(0,colon)};
  }else{const m=line.match(/^METHOD:(PUBLISH|REQUEST|REPLY|CANCEL|ADD|COUNTER|DECLINECOUNTER)$/i);if(m)method=m[1]!.toUpperCase();}
 }
 if(inEvent||!events.length)return [review('Convite de calendário','VEVENT ausente ou não finalizado')];
 return events;
}
