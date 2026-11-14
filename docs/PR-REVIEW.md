# PR #1 — revisão técnica adversarial da atualização Aurora 2.3 → 2.4

PR: https://github.com/kelwin-feitosa/Aurora/pull/1
Origem: feature/aurora-2.3; target: main. Estado pretendido **OPEN + DRAFT**, SEM MERGE.

## Revisão do diff da 2.3 e regressões

A 2.3 adicionou perfis per-connection strict/extended/personal, triagem por cabeçalhos, opt-out sensível, contadores de descarte e rescan. Verificado comportamento por leitura do pipeline, migrations/0016 e tests/monitoring.test.mjs.

Achado F02: rescan originalmente reenfileirava o mesmo ID sem modificar condição de leitura; mesma mensagem era descartada outra vez. **Corrigido** por flag one-shot após consentimento e migração aditiva 0017. Bloqueios explícitos e categorias sensíveis não podem ser sobrepostos pelo rescan.

Achado F03: métodos Push ignoravam o parâmetro de sessão, revelando e revogando status de aparelhos de outras sessões. **Corrigido** por condição WHERE session_hash, e teste de sessão B contra inscrição A.

Achado F04: Outlook pedia envelope em GET separado apesar de já poder receber esses campos no delta. **Otimizado** por reaproveitamento só em memória, com fallback para delta antigos, sem persistir remetente no banco.

Achado F01 mitigado no commit cd05e0ad: autoaprovação por From **desativada**; testes de integração agora usam confirmação autenticada explícita. Essa alteração remove intencionalmente o comportamento inseguro do modo trusted-senders. Pendentes: F05 custos/CPU/quotas reais não medidos, F07 falsos negativos em assuntos genéricos e homologações externas; ver AUDIT/FINDINGS.md.

## Gates esperados

- Build, typecheck, lint/test, smoke, npm audit e scripts estáticos aprovados na última cabeça.
- Provar que 40 novos casos adversariais passam e não apagaram os 108 testes preexistentes; número final informado pelo CI.
- ZIP criado com git archive da cabeça da branch, unzip -t, SHA-256, lockfile e migração 0017 presentes.
- Migração D1 executada apenas em ambiente de teste autorizado com backup; não no banco vivo.
- GO somente para revisão interna. Não fazer merge automático, deploy, publicação de release, alteração de cobrança ou marcação como ready-for-review sem autorização.

## Decisão de revisão

**Changes requested / bloqueio de homologação externa.** As correções 2.4 são úteis e testadas em CI; não se declara homologação institucional, nem se ignora risco de falso remetente. Manter o PR como rascunho até decisão explícita do titular.
