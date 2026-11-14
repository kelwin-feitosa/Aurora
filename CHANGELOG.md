## 2.2.0-rc.1 (2026-11-13)
- Retomada de mensagens em páginas pendentes após 3 minutos; contas sem atraso aguardam 15 minutos; Cron Trigger definido em 3 minutos.
- Indicadores de saúde por conexão e de backlog; esquema aditivo 0013–0015.
- Web Push opt-in com JWT VAPID ES256, URLs HTTPS de push estritamente validadas, endpoints cifrados, aviso genérico e horários de silêncio por fuso; calendar continua canal principal.
- Onboarding por verificação, com opção de pular notificações e teste do calendário apenas depois de operação realmente confirmada.
- 98 testes locais aprovados; benchmark de filas sintético, sem deploy/contas reais. npm registry indisponível; sem lockfile; **NO-GO público**.

## 2.0.0-rc.1 — Auditoria aplicada (não homologada)

- Política **review-first** e allowlist exata opt-in para autores que podem criar eventos sem confirmação, com ressalva de autenticação de remetente.
- Reconciliação Gmail com prova de propriedade via extendedProperties; busca Graph interrompida por paginação incompleta ou URL divergente.
- OAuth token response limitada a 64 KiB; deltaLink do Graph com caminho exato e teto de URL.
- Cotas calendar_writes reservadas atomicamente **antes** das chamadas remotas, contabilizando falhas incertas.
- Economia por tick: manutenção diária isolada, consulta extra de cota de leitura retirada, backoff por conexão (migração 0012).
- MIME limitado globalmente; mensagens truncadas geram revisão. Conflitos `14:00` vs `16:00` corrigidos.
- Migração 0011 coloca itens automáticos antigos ainda não enviados em revisão.
- 16 testes adversariais novos, corpus sintético de 68 mensagens, relatório antes/depois e release gate estrito.
- CI exige `npm ci` e `npm audit` (intencionalmente bloqueado até gerar lockfile com acesso oficial ao registry).

# Histórico de alterações

## 1.6.0-technical-final — 13/11/2026

- Integração limitada e segura de convites ICS de Gmail/Outlook, apenas em revisão humana; regras restritivas para recorrência, timezone, campos duplicados e VALARM.
- Mensagens com até três compromissos extraíveis geram propostas distintas, idempotentes e com confirmação individual; caso ambíguo não gera publicação automática.
- Geração de backup remoto D1 via Wrangler, AES-256-GCM/scrypt e restauração somente em alvo novo/vazio/quarentenado. **Testado com CLI simulada, não Cloudflare**.
- Exportação autenticada paginada para todo o histórico acessível; API não exporta tokens; distinção explícita entre JSON export e backup completo.
- Interface de revogação de sessões e exibição de orçamento; proteção contra confirmação duplicada; retenção de excertos de e-mail eliminada e migração `0010`.
- Otimização de limpeza de registros antigos (verifica e elimina apenas quando necessário, sem rodar três deletes todo cron); novos índices para consultas/exportação.
- Suíte ampliada de testes adversariais, regressão e orçamento sintético, com documentação e matriz de aceite.
- **Não concluído externamente:** Cloudflare/Worker/D1 real, OAuth institucional, browsers reais, npm audit/lockfile/CI remota e instalação pública universal de um clique.

# Histórico de alterações

## 1.5.0-rc.1 — 12/11/2026

- PWA instalável, manifesto, ícones PNG, service worker com cache allowlist de arquivos públicos e fallback offline sem dados pessoais.
- Páginas públicas `/instalar` e `/demonstracao`, sem credenciais e sem APIs externas.
- Interface responsiva adicional, orientação de instalação Android/iOS/desktop, suporte a teclado nas abas e modais, filtros locais de atividades.
- Diagnóstico autenticado de banco, configurações OAuth, status do cron e conexões; confirmação do cron registrada no backend.
- Revisão explícita de mensagens de alteração/cancelamento, seleção humana do evento original e atualização em fila segura.
- Recuperação manual de falhas, visualização de ações bloqueadas e opção de ignorar mensagens ambíguas.
- Correção da validação de datas locais após as 21h, removendo dependência de conversão UTC.
- Teste de migração 1.1→1.2 agora autossuficiente, sem exigir a pasta original 1.1.
- Testes adicionais da PWA, rotas públicas/privadas, modo de demonstração, revisão e diagnósticos.

**Não concluído:** OAuth institucional, deploy Cloudflare, teste browser real no ambiente atual (política administrativa bloqueou localhost), auditoria npm online e instalação pública com um clique.

## 1.2 — histórico preservado

Consulte `docs/RELEASE-1.2.md` e `docs/MIGRATION-1.2.md`.
