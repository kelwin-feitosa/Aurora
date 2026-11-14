import test from 'node:test';
import assert from 'node:assert/strict';
import {triageEnvelope,DEFAULT_RULES} from '../src/domain/monitoring.ts';
import {validatePushEndpoint} from '../src/app/push.ts';
import {safeGraphUrl} from '../src/providers/http.ts';
/** 40 distinct adversarial boundary fixtures. Not an empirical user-mail corpus. */
const base={...DEFAULT_RULES};
const allow={...base,allowed_domains:['faculdade.edu.br'],allowed_senders:['docente@externo.test']};
const blocked={...allow,blocked_senders:['abuso@externo.test'],blocked_domains:['spam.test']};
const ext={...base,mode:'academic_extended'};
const personal={...base,mode:'personal'};
const optin={...personal,sensitive_opt_in:true};
const triage=(subject,sender='a@x.test',rules=base)=>triageEnvelope({id:'adversarial',subject,sender,receivedAt:'2026-11-14T00:00:00Z'},rules).action;
const cases=[
 // Untrusted sender parsing and domain boundaries (1–11)
 ['sender ausente',()=>assert.equal(triage('Prova', ''),'uncertain')],
 ['injeção CRLF de remetente',()=>assert.equal(triage('Prova','a@x.test\r\nBcc: attacker@x.test'),'uncertain')],
 ['remetente com múltiplos endereços',()=>assert.equal(triage('Olá','a@x.test, b@x.test',allow),'uncertain')],
 ['sufixo do domínio autorizado',()=>assert.equal(triage('Olá','a@faculdade.edu.br.evil.test',allow),'uncertain')],
 ['domínio semelhante mas diferente',()=>assert.equal(triage('Olá','a@faculdade-edu.br',allow),'uncertain')],
 ['remetente na allowlist exata',()=>assert.equal(triage('Olá','docente@externo.test',allow),'read')],
 ['allowlist insensível a caixa ASCII',()=>assert.equal(triage('Olá','Docente <PROF@FACULDADE.EDU.BR>',allow),'read')],
 ['bloqueio de remetente antes de assunto acadêmico',()=>assert.equal(triage('Prova','abuso@externo.test',blocked),'skip')],
 ['bloqueio de domínio antes de assunto acadêmico',()=>assert.equal(triage('Prova','a@spam.test',blocked),'skip')],
 ['promoção é dispensada',()=>assert.equal(triage('Cupom desconto exclusivo'),'skip')],
 ['assunto genérico é incerto',()=>assert.equal(triage('Olá'),'uncertain')],
 // Strict academic mode and risky false negatives (12–20)
 ['prova',()=>assert.equal(triage('Prova de cálculo'),'read')],
 ['avaliação',()=>assert.equal(triage('Avaliação final'),'read')],
 ['entrega',()=>assert.equal(triage('Entrega do trabalho'),'read')],
 ['matrícula',()=>assert.equal(triage('Matrícula aberta'),'read')],
 ['monitoria',()=>assert.equal(triage('Monitoria de cálculo'),'read')],
 ['trabalho de TCC',()=>assert.equal(triage('TCC - revisão'),'read')],
 ['edital no estrito ainda incerto',()=>assert.equal(triage('Edital 2026'),'uncertain')],
 ['bolsa no estrito ainda incerta',()=>assert.equal(triage('Bolsa pesquisa'),'uncertain')],
 ['consulta no estrito permanece fora',()=>assert.equal(triage('Consulta clínica'),'uncertain')],
 // Explicit academic extended opt-in (21–28)
 ['bolsa ampliada',()=>assert.equal(triage('Bolsa disponível','a@x.test',ext),'read')],
 ['edital ampliado',()=>assert.equal(triage('Edital publicado','a@x.test',ext),'read')],
 ['hackathon ampliado',()=>assert.equal(triage('Hackathon de tecnologia','a@x.test',ext),'read')],
 ['seleção ampliada',()=>assert.equal(triage('Seleção aberta','a@x.test',ext),'read')],
 ['inscrição ampliada',()=>assert.equal(triage('Inscrição encerrando','a@x.test',ext),'read')],
 ['pesquisa ampliada',()=>assert.equal(triage('Pesquisa acadêmica','a@x.test',ext),'read')],
 ['congresso ampliado',()=>assert.equal(triage('Congresso de ciência','a@x.test',ext),'read')],
 ['entrevista ampliada',()=>assert.equal(triage('Entrevista na terça','a@x.test',ext),'read')],
 // Personal data and explicit sensitive opt-out (29–35)
 ['consulta sensível desativada',()=>assert.equal(triage('Consulta dentista','a@x.test',personal),'skip')],
 ['fatura sensível desativada',()=>assert.equal(triage('Sua fatura','a@x.test',personal),'skip')],
 ['boleto sensível desativado',()=>assert.equal(triage('Boleto disponível','a@x.test',personal),'skip')],
 ['pagamento sensível desativado',()=>assert.equal(triage('Pagamento pendente','a@x.test',personal),'skip')],
 ['banco sensível desativado',()=>assert.equal(triage('Aviso do banco','a@x.test',personal),'skip')],
 ['aniversário pessoal não sensível',()=>assert.equal(triage('Aniversário sábado','a@x.test',personal),'read')],
 ['consulta sensível ativada',()=>assert.equal(triage('Consulta dentista','a@x.test',optin),'read')],
 // SSRF and Graph cursor attacks (36–40)
 ['gateway Push desconhecido',()=>assert.throws(()=>validatePushEndpoint('https://evil.test/x'),/PUSH_ENDPOINT_REJECTED/)],
 ['gateway Push com credenciais',()=>assert.throws(()=>validatePushEndpoint('https://u:secret@fcm.googleapis.com/x'),/PUSH_ENDPOINT_REJECTED/)],
 ['gateway Push porta alternativa',()=>assert.throws(()=>validatePushEndpoint('https://fcm.googleapis.com:444/x'),/PUSH_ENDPOINT_REJECTED/)],
 ['delta Graph outro caminho',()=>assert.throws(()=>safeGraphUrl('https://graph.microsoft.com/v1.0/me/messages/delta'),/GRAPH_DELTA_URL_BLOCKED/)],
 ['delta Graph host adversário',()=>assert.throws(()=>safeGraphUrl('https://graph.microsoft.com.evil.test/v1.0/me/mailFolders/inbox/messages/delta'),/GRAPH_DELTA_URL_BLOCKED/)]
];
assert.equal(cases.length,40,'2.4 adversarial fixture count changed');
for(const [name,run] of cases)test('2.4 adversarial: '+name,run);
