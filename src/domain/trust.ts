import type {Env,RemoteMessage,AcademicDecision} from '../types.ts';
/** Emails and their From headers are untrusted data. There is currently no
 * provider-authenticated sender attestation available in the adapter contract.
 * The legacy trusted-senders setting is deliberately fail-closed until an
 * authenticated implementation is available; NO automatic calendar writes. */
export function allowedAutomaticSender(_env:Env,_message:RemoteMessage):boolean {
 return false;
}
export function applyAutomationPolicy(env:Env,message:RemoteMessage,decisions:AcademicDecision[]):AcademicDecision[]{
 const trusted=allowedAutomaticSender(env,message);
 return decisions.map(d=>d.state==='approved'&&!trusted?{
  ...d,state:'review',confidence:'ambiguous',
  rationale:'Revisão obrigatória: o campo From não comprova a identidade do remetente. Confirme a origem e os dados antes de criar compromissos.'
 }:d);
}
