# Segurança Aurora 1.6 — modelo de ameaças, controles e evidências

**Escopo:** revisão local com testes Node/SQLite e adaptadores HTTP simulados. Não houve pentest independente, auditoria de dependências online, deploy real ou teste institucional autorizado.

| Ameaça | Controle implementado | Evidência/risco residual |
|---|---|---|
| Cookie roubado após logout | Sessão HMAC assinada **mais registro hash em `sessions`**, revogável e expiração 8 h | Teste logout/stolen cookie; revogação de sessões exige acesso à instância |
| Troca de conta em OAuth | `state` 1 vez, PKCE, `session_hash` no pending, callback validado na mesma sessão | Testes de tentativa com outra sessão; políticas institucionais não validadas |
| Vazamento de tokens | AES-GCM com AAD por provedor e conexão; nunca enviados na API de dados | Teste de cifragem; chave de instalação deve ser guardada fora do repositório |
| CSRF | Origin estrito em mutações, cookie SameSite Lax, content type JSON para comandos com payload | Testes HTTP locais; navegadores reais pendentes |
| XSS/HTML de e-mails | UI usa `textContent`; CSP self-only; classificador sem execução de código externo | Dados sintéticos; HTML complexo pode ser mal interpretado |
| Acesso a URL arbitrária (SSRF) | Allowlist HTTPS sem credenciais na URL, delta Graph com caminho/host validados e redirecionamento desabilitado | Teste URL host malicioso; verificar novos provedores no futuro |
| Resposta de provedor enorme | Limite de 512 KiB durante leitura do corpo e timeout 12 s | Testes locais; mensagens legítimas maiores exigem tratamento de revisão |
| Operação em calendário alheio | Calendário próprio e `readOwnedEvent` exige `source_id`/`transactionId` esperado | Tests Gmail e Graph mocks; sem prova institucional real |
| Falha após POST/PATCH/DELETE | Outbox e journal de alterações, IDs estáveis, reconciliação, estado unknown/blocked | Testes POST/PATCH com resposta perdida; reconciliação Graph real não provada |
| Brute force | Instalação com senha longa, limitador de tentativas por impressão de IP, servidor local loopback | Ataques distribuídos e configuração WAF seguem risco residual |
| Quota/loop infinito | Contador de tentativas por ciclo/dia, retry finito, ações incertas bloqueadas | Cotas de CPU/D1 não mensuradas offline |
| Backup local | Scripts de backup/restore cifrados anteriores mantidos | Teste de nuvem e recuperação D1 pendente |

## Decisões defensivas

1. Não habilitar IA externa ou armazenamento de corpo completo de e-mail por padrão.
2. Correção/cancelamento remotos **somente por confirmação humana**, quando o evento remoto pertence ao Aurora. Um comunicado de remarcação sem vínculo forte fica na revisão.
3. Uma resposta desconhecida de mutação é reconciliada antes de qualquer repetição. Se não houver prova suficiente, bloquear para inspeção.
4. Nunca copiar chaves `.dev.vars`, `.env`, banco SQLite, backups, dados pessoais nem tokens para GitHub ou ZIP distribuível.
5. `scripts/security-check.mjs` é uma higiene estática simples: **não substitui SAST profissional, `npm audit`, pentest ou revisão externa**.

## Bloqueios de produção

- Obter autorização e validar OAuth Gmail e Outlook em contas consentidas, sem compartilhar credenciais em conversas.
- Validar D1/Workers Free na nuvem, limites por execução e recuperações reais.
- Gerar lockfile e executar `npm ci`, auditoria de dependências e CI remota; esta sessão não possui acesso ao registry.
- Revisão de navegador real e controles de segurança de dispositivo, aplicação da LGPD e política de divulgação de vulnerabilidades.


## Reforços da 1.6 (testados localmente)

- Convites ICS nunca fazem gravação remota automática; parser limita tamanho/linhas/eventos, recusa conteúdo malformado e protege contra campos duplicados, `VALARM` malicioso, cancelamentos/recorrências e zonas desconhecidas. Texto de e-mail é dado, **não instrução**.
- Uma mensagem com múltiplas datas válidas gera propostas separadas em revisão, não execução automática. Mais de três itens não são truncados sem aviso.
- Revisões manuais incluem bloqueio transacional de duplicata com mesma identidade de compromisso. O sistema mantém bloqueio de mutação se a origem do evento remoto não estiver comprovada.
- Tokens e segredos permanecem fora da exportação pública; excertos de corpo deixam de ser persistidos em SQL; migração `0010` elimina excertos antigos.
- Backup D1 autenticado AES-256-GCM/scrypt com senha errada/violação de integridade rejeitadas; restauração em quarentena, nunca sobre base ativa. Ensaiado com fake Wrangler, **não Cloudflare real**.
- Revogação de outros dispositivos por hash de sessão e confirmação de usuário; cache da PWA só permite assets públicos.

**Limites:** `security:check` é varredura superficial, não SAST/SCA/pentest. Sem lockfile nem npm audit verificado (registry indisponível); autorização OAuth institucional, Workers D1 e browsers reais pendentes.
