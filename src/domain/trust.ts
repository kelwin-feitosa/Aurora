import type {Env,RemoteMessage,AcademicDecision} from '../types.ts';
/** Sender headers are untrusted claims, NOT proof of DKIM/DMARC. Default to
 * human review. The strict allowlist is an informed, opt-in convenience. */
export function allowedAutomaticSender(env:Env,message:RemoteMessage):boolean {
 if(env.AUTO_APPROVE_MODE!=='trusted-senders')return false;
 const addresses=(env.TRUSTED_SENDER_ADDRESSES??'').split(',').map(v=>v.trim().toLowerCase());
 const raw=(message.sender??'').trim();
 if(!raw||raw.length>320||/[\r\n]/.test(raw))return false;
 const match=raw.match(/^(?:[^<>]*<)?([a-z0-9._%+\-]+@[a-z0-9.\-]+)(?:>)?$/i);
 if(!match)return false;
 return addresses.includes(match[1]!.toLowerCase());
}
export function applyAutomationPolicy(env:Env,message:RemoteMessage,decisions:AcademicDecision[]):AcademicDecision[]{
 const trusted=allowedAutomaticSender(env,message);
 return decisions.map(d=>d.state==='approved'&&!trusted?{
  ...d,state:'review',confidence:'ambiguous',
  rationale:'Revisão obrigatória: remetente não autorizado para criar compromissos automaticamente. Confira a origem antes de confirmar.'
 }:d);
}
