import type {RemoteMessage,AcademicDecision} from '../types.ts';
import {parseCalendarInvites} from './ical.ts';

const words={
 event:/\b(prova|avaliação|avaliacao|exame|seminário|seminario|palestra|aula|reunião|reuniao|turno de estágio|turno de estagio|plantão marcado|plantao marcado|encontro|atividade presencial)\b/i,
 task:/\b(entrega|entregar|enviar|submeter|postar|prazo|trabalho|relatório|relatorio|atividade|exercício|exercicio|formulário|formulario|inscrição|inscricao)\b/i,
 cancel:/\b(cancelad[oa]|suspens[ao]|não haverá|nao havera|remarcad[oa]|adiad[oa]|alterad[oa]|antecipad[oa]|prorrogad[oa])\b/i,
 spam:/\b(cupom|desconto exclusivo|oferta imperdível|promocao relampago|promoção relâmpago|frete grátis|frete gratis)\b/i,
 uncertain:/\b(talvez|possivelmente|a confirmar|sem data definida|data ainda será|ainda sera confirmado|a definir)\b/i,
 relative:/\b(amanhã|amanha|depois de amanhã|próxima|proxima|sexta|segunda|terça|terca|quarta|quinta|sábado|sabado|domingo|semana que vem|nesta semana)\b/i,
};
const months:Record<string,number> = {janeiro:1,fevereiro:2,marco:3,março:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
function validDate(y:number,m:number,d:number):boolean{
 const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d&&y>=2000&&y<=2100;
}
function extractDate(text:string):{date:string|null,withoutYear:boolean,evidence:string}{
 const iso=text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
 if(iso){const y=Number(iso[1]),m=Number(iso[2]),d=Number(iso[3]);return{date:validDate(y,m,d)?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null,withoutYear:false,evidence:iso[0]};}
 const numeric=text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/);
 if(numeric){const d=Number(numeric[1]),m=Number(numeric[2]),y=Number(numeric[3]);return{date:validDate(y,m,d)?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null,withoutYear:false,evidence:numeric[0]};}
 const named=text.match(/\b(\d{1,2})(?:[º°])?\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})\b/i);
 if(named){const d=Number(named[1]),m=months[named[2]!.toLowerCase()]!,y=Number(named[3]);return{date:validDate(y,m,d)?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null,withoutYear:false,evidence:named[0]};}
 const dateOnly=text.match(/\b\d{1,2}[\/.](?:0?[1-9]|1[0-2])\b(?![\/.]\d)/);
 return{date:null,withoutYear:Boolean(dateOnly),evidence:dateOnly?.[0]??''};
}
function extractTime(text:string):{hh:string|null,evidence:string}{
 const match=text.match(/\b(?:às|as|pelas|às\s*)\s*(\d{1,2})(?:(?:h|:)(\d{2})?)?\b/i)??text.match(/\b(\d{1,2})\s*h\s*(\d{0,2})\b/i);
 if(!match)return {hh:null,evidence:''};
 const hour=Number(match[1]), minute=Number(match[2]??0);
 if(hour>23||minute>59)return {hh:null,evidence:match[0]};
 return {hh:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`,evidence:match[0]};
}
export function classify(message:RemoteMessage):AcademicDecision{
 const title=message.subject.replace(/[<>\r\n\u0000-\u001f]/g,' ').trim().slice(0,140)||'Aviso acadêmico';
 const text=(message.subject+'\n'+message.body).slice(0,10000);
 const messageBody=message.body.replace(/[\u0000-\u001f]/g,' ').trim();
 const excerpt=messageBody.slice(0,260);
 const base={title,details:'Comunicado identificado automaticamente; consulte a mensagem original para detalhes.',source_excerpt:excerpt};
 const evt=words.event.test(text),task=words.task.test(text),cancel=words.cancel.test(text);
 const date=extractDate(text),time=extractTime(text);
 const numericDates=[...text.matchAll(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/g)].map(m=>`${m[3]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`);
 const namedDates=[...text.matchAll(/\b(\d{1,2})(?:[º°])?\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})\b/gi)].map(m=>`${m[3]}-${String(months[m[2]!.toLowerCase()]).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`);
 const isoDates=[...text.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)].map(m=>`${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`);
 const conflictDates=new Set([...numericDates,...namedDates,...isoDates]).size>1;
 const times=[...text.matchAll(/\b([01]?\d|2[0-3])\s*h\s*(\d{0,2})\b/gi)].map(m=>`${String(Number(m[1])).padStart(2,'0')}:${String(Number(m[2]??0)).padStart(2,'0')}`);
 const conflictTimes=new Set(times).size>1;
 const isPast=Boolean(date.date && Number.isFinite(Date.parse(message.receivedAt)) && date.date < new Date(message.receivedAt).toISOString().slice(0,10));
 const ambiguous=words.uncertain.test(text)||words.relative.test(text)||cancel||date.withoutYear||Boolean(date.evidence&&!date.date)||conflictDates||conflictTimes||isPast;
 if(words.spam.test(text)&&!evt&&!task)return {...base,kind:'notice',state:'ignored',confidence:'ambiguous',start_at:null,due_date:null,rationale:'Conteúdo promocional detectado; usuário pode revisar.'};
 if(!evt&&!task)return {...base,kind:'notice',state:'notice',confidence:'incomplete',start_at:null,due_date:null,rationale:'Nenhum compromisso explícito identificado.'};
 if(cancel)return {...base,kind:'review',state:'review',confidence:'ambiguous',start_at:null,due_date:date.date,rationale:'Comunicado menciona alteração ou cancelamento: selecione manualmente o compromisso original antes de modificar a agenda.'};
 if(ambiguous)return {...base,kind:'review',state:'review',confidence:'ambiguous',start_at:null,due_date:date.date,rationale:'Referência temporal ambígua ou contraditória: exige revisão humana.'};
 if(evt && task) return {...base,kind:'review',state:'review',confidence:'ambiguous',start_at:null,due_date:date.date,rationale:'Mensagem menciona evento e atividade; confirmar classificação.'};
 if(evt&&date.date&&time.hh){
  return {...base,kind:'event',state:'approved',confidence:'explicit',start_at:`${date.date}T${time.hh}`,due_date:null,rationale:`Data e horário explícitos (${date.evidence}, ${time.evidence}).`};
 }
 if(task&&date.date){return {...base,kind:'task',state:'approved',confidence:'explicit',start_at:null,due_date:date.date,rationale:`Prazo explícito (${date.evidence}); horário não presumido.`};}
 return {...base,kind:'review',state:'review',confidence:'incomplete',start_at:null,due_date:date.date,rationale:'Não há dados suficientes para criar compromisso sem adivinhar.'};
}
/** Escape user-controlled string for safe HTML text rendering. Never use innerHTML for emails. */
export function escapeHtml(s:string):string{return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

/** A short, cautious multi-event strategy. Nothing from a multi-item email is
 * written remotely without individual human approval. We keep up to three
 * independently reviewable proposals; larger/malformed lists remain one review.
 */
export function classifyMany(message:RemoteMessage):AcademicDecision[]{
 if(message.calendarText?.length){
  if(message.calendarText.length>2)return [{...classify(message),kind:'review',state:'review',confidence:'ambiguous',rationale:'Múltiplos anexos de calendário: conferir manualmente antes de qualquer ação',start_at:null}];
  return message.calendarText.flatMap(s=>parseCalendarInvites(s)).slice(0,3);
 }
 const lines=message.body.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length<2||lines.length>30)return [classify(message)];
 const relevant=lines.filter(x=>/\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}|\d{1,2}\s+de\s+[a-zç]+\s+de\s+20\d{2})\b/i.test(x));
 if(relevant.length<2)return [classify(message)];
 if(relevant.length>3)return [{...classify(message),kind:'review',state:'review',confidence:'ambiguous',start_at:null,rationale:'Mensagem contém mais de três datas: exige revisão integral, sem descartar compromissos silenciosamente'}];
 const proposals=relevant.map(line=>classify({...message,subject:line.slice(0,140),body:line,calendarText:undefined}));
 // If any line cannot be classified as a specific event/task, force one
 // holistic review; fragments must not be silently misinterpreted.
 if(proposals.some(x=>!['event','task'].includes(x.kind)||!x.start_at&&!x.due_date))
  return [{...classify(message),kind:'review',state:'review',confidence:'ambiguous',start_at:null,rationale:'Mensagem com várias datas, algumas ambíguas: revise a mensagem completa'}];
 return proposals.map(x=>({...x,state:'review',confidence:'ambiguous',
  rationale:'Uma das datas da mensagem com múltiplos compromissos: confirme cada item separadamente antes de criar lembretes.'}));
}
