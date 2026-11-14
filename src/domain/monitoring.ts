import type {DB,RemoteMessage,AcademicDecision} from '../types.ts';
import {classifyMany} from './classifier.ts';

/** Accounts have independent, opt-in scopes. No mode changes OAuth scopes. */
export type MonitoringMode='academic_strict'|'academic_extended'|'personal';
export interface MonitoringRules {
 mode:MonitoringMode;
 allowed_senders:string[];
 allowed_domains:string[];
 blocked_senders:string[];
 blocked_domains:string[];
 sensitive_opt_in:boolean;
}
export interface MessageEnvelope {id:string;subject:string;sender:string;receivedAt:string;}
export type Triage='read'|'skip'|'uncertain';
export const DEFAULT_RULES:MonitoringRules=Object.freeze({mode:'academic_strict',allowed_senders:[],allowed_domains:[],blocked_senders:[],blocked_domains:[],sensitive_opt_in:false});
const ACADEMIC=/\b(prova|avaliaç[aã]o|exame|trabalho|entrega|prazo|aula|matr[ií]cula|faculdade|universidade|disciplina|profess[oa]r|acad[eê]mic[ao]|calend[aá]rio|atividade|relat[oó]rio|monitoria|tcc|secretaria|semestre|laborat[oó]rio|ementa|formatura|col[aá]gio|escola|classroom|moodle|est[aá]gio curricular)\b/i;
const EXTENDED=/\b(bolsa|congresso|simp[oó]sio|curso|certificado|edital|entrevista|seleç[aã]o|inscriç[aã]o|pesquisa|extens[aã]o|est[aá]gio|oportunidade|hackathon|capacitaç[aã]o|evento de carreira)\b/i;
const PERSONAL=/\b(consulta|m[eé]dic[oa]|dentista|reuni[aã]o|agendamento|anivers[aá]rio|passagem|reserva|pagamento|vencimento|fatura|boleto|condom[ií]nio|compromisso|serviç[oa]|entrega|prazo)\b/i;
const SENSITIVE=/\b(consulta|m[eé]dic[oa]|dentista|hospital|exame cl[ií]nico|boleto|fatura|pagamento|banco|cart[aã]o|d[ií]vida|sa[uú]de)\b/i;
const JUNK=/\b(promoç[aã]o|cupom|desconto exclusivo|frete gr[aá]tis|newsletter|oferta imperd[ií]vel|black friday|liquidaç[aã]o|an[uú]ncio publicit[aá]rio)\b/i;
function address(sender:string):string|null{
 if(sender.length>320||/[\r\n]/.test(sender))return null;
 const m=sender.trim().match(/^(?:[^<>]*<)?([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+)>?$/);
 return m?m[1]!.toLowerCase():null;
}
function domainMatches(address:string,domain:string):boolean{return address.endsWith('@'+domain);}
export function triageEnvelope(envelope:MessageEnvelope,rules:MonitoringRules):{action:Triage;reason:string}{
 const sender=address(envelope.sender);
 if(!sender)return {action:'uncertain',reason:'SENDER_UNVERIFIED_OR_MALFORMED'};
 if(rules.blocked_senders.includes(sender)||rules.blocked_domains.some(d=>domainMatches(sender,d)))return {action:'skip',reason:'EXPLICITLY_BLOCKED_SOURCE'};
 const trusted=rules.allowed_senders.includes(sender)||rules.allowed_domains.some(d=>domainMatches(sender,d));
 const subject=envelope.subject.slice(0,400);
 if(rules.mode==='personal'&&SENSITIVE.test(envelope.subject)&&!rules.sensitive_opt_in)return {action:'skip',reason:'SENSITIVE_CATEGORY_OPT_OUT'};
 if(trusted)return {action:'read',reason:'USER_INCLUDED_SOURCE'};
 if(JUNK.test(subject))return {action:'skip',reason:'PROMOTIONAL_SUBJECT'};
 if(rules.mode==='personal'){
  return PERSONAL.test(subject)||ACADEMIC.test(subject)?{action:'read',reason:'PERSONAL_SUBJECT_MATCH'}:{action:'uncertain',reason:'UNRECOGNIZED_PERSONAL_SOURCE'};
 }
 if(ACADEMIC.test(subject))return {action:'read',reason:'ACADEMIC_SUBJECT_MATCH'};
 if(rules.mode==='academic_extended'&&EXTENDED.test(subject))return {action:'read',reason:'EXTENDED_SUBJECT_MATCH'};
 return {action:'uncertain',reason:'UNRECOGNIZED_SOURCE'};
}
/** Unknown metadata are not fetched in strict/extended modes. Count exclusions without retaining headers. */
export function shouldRead(decision:{action:Triage},rules:MonitoringRules):boolean{return decision.action==='read';}
export function evaluateScope(message:RemoteMessage,rules:MonitoringRules):AcademicDecision[]{
 const decisions=classifyMany(message,rules.mode);
 return decisions.map(d=>{
  if(rules.mode==='personal'&&SENSITIVE.test(message.subject)&&!rules.sensitive_opt_in)
   return {...d,kind:'review',state:'review',confidence:'ambiguous',start_at:null,rationale:'Categoria sensível desativada: revisar permissão antes de criar compromisso.'};
  // Personal/extended never auto-approve: source may contain untrusted instructions.
  if(rules.mode!=='academic_strict'&&d.state==='approved')return {...d,state:'review',rationale:`${d.rationale} Confirmação obrigatória no perfil ${rules.mode==='personal'?'pessoal':'acadêmico ampliado'}.`};
  return d;
 });
}
const EMAIL=/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+$/;
const DOMAIN=/^(?:[A-Za-z0-9\-]+\.)+[A-Za-z]{2,}$/;
function uniqueEntries(value:unknown,kind:'sender'|'domain'):string[]{
 if(!Array.isArray(value)||value.length>30)throw new Error('INVALID_MONITORING_LIST');
 const output=new Set<string>();
 for(const entry of value){
  if(typeof entry!=='string')throw new Error('INVALID_MONITORING_ENTRY');
  const x=entry.trim().toLowerCase();
  if(x.length>254||!(kind==='sender'?EMAIL:DOMAIN).test(x)||x.includes('..'))throw new Error('INVALID_MONITORING_ENTRY');
  output.add(x);
 }
 return [...output];
}
export function validateRules(data:unknown):MonitoringRules{
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('INVALID_MONITORING_RULES');
 const x=data as Record<string,unknown>;
 if(!['academic_strict','academic_extended','personal'].includes(String(x.mode)))throw new Error('INVALID_MONITORING_MODE');
 if(typeof x.sensitive_opt_in!=='boolean')throw new Error('INVALID_SENSITIVE_OPT_IN');
 const result:MonitoringRules={mode:x.mode as MonitoringMode,allowed_senders:uniqueEntries(x.allowed_senders,'sender'),allowed_domains:uniqueEntries(x.allowed_domains,'domain'),blocked_senders:uniqueEntries(x.blocked_senders,'sender'),blocked_domains:uniqueEntries(x.blocked_domains,'domain'),sensitive_opt_in:x.sensitive_opt_in};
 if(result.allowed_senders.some(s=>result.blocked_senders.includes(s))||result.allowed_domains.some(d=>result.blocked_domains.includes(d)))throw new Error('MONITORING_RULE_CONFLICT');
 return result;
}
export async function getRules(db:DB,connectionId:string):Promise<MonitoringRules>{
 const row=await db.prepare('SELECT mode,allowed_senders,allowed_domains,blocked_senders,blocked_domains,sensitive_opt_in FROM connection_monitoring WHERE connection_id=?').bind(connectionId).first<{mode:MonitoringMode;allowed_senders:string;allowed_domains:string;blocked_senders:string;blocked_domains:string;sensitive_opt_in:number}>();
 if(!row)return {...DEFAULT_RULES};
 try{return validateRules({...row,allowed_senders:JSON.parse(row.allowed_senders),allowed_domains:JSON.parse(row.allowed_domains),blocked_senders:JSON.parse(row.blocked_senders),blocked_domains:JSON.parse(row.blocked_domains),sensitive_opt_in:row.sensitive_opt_in===1});}
 catch{throw new Error('INVALID_STORED_MONITORING_RULES');}
}
export async function setRules(db:DB,connectionId:string,rules:MonitoringRules,now:number):Promise<void>{
 const updated=await db.prepare(`INSERT INTO connection_monitoring(connection_id,mode,allowed_senders,allowed_domains,blocked_senders,blocked_domains,sensitive_opt_in,updated_at)
 SELECT id,?,?,?,?,?,?,? FROM connections WHERE id=? ON CONFLICT(connection_id) DO UPDATE SET mode=excluded.mode,allowed_senders=excluded.allowed_senders,allowed_domains=excluded.allowed_domains,blocked_senders=excluded.blocked_senders,blocked_domains=excluded.blocked_domains,sensitive_opt_in=excluded.sensitive_opt_in,updated_at=excluded.updated_at`).bind(rules.mode,JSON.stringify(rules.allowed_senders),JSON.stringify(rules.allowed_domains),JSON.stringify(rules.blocked_senders),JSON.stringify(rules.blocked_domains),rules.sensitive_opt_in?1:0,now,connectionId).run();
 if(Number(updated.meta?.changes??0)!==1)throw new Error('MONITORING_CONNECTION_NOT_FOUND');
}
export async function recordFiltered(db:DB,connectionId:string,inboxId:number,reason:string,now:number):Promise<void>{
 if(!db.batch)throw new Error('DB_ATOMIC_BATCH_REQUIRED');
 // Trigger counts a skipped message once, even after a retry. Never persist headers/body.
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO monitoring_skips(inbox_id,connection_id,reason,at) VALUES(?,?,?,?)').bind(inboxId,connectionId,reason,now),
  db.prepare("UPDATE inbox SET state='done',last_error=NULL WHERE id=? AND connection_id=?").bind(inboxId,connectionId)
 ]);
}
