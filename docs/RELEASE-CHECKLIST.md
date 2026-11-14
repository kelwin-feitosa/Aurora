# Checklist de candidata privada Aurora 2.4.0-rc.1

Data 2026-11-14. PR #1, branch feature/aurora-2.3. Este documento define portas, não autoriza execução remota.

## Evidências concluídas

- [x] Revisão inicial do PR e do diff 2.3 com achados no AUDIT/FINDINGS.md.
- [x] Correção rescan preservando bloqueio explícito e opt-out sensível (migration 0017), testes de falha original e regressão.
- [x] Push list/unsubscribe vinculados à sessão e regressão inter-sessões.
- [x] Outlook reusa cabeçalho do delta com fallback legado.
- [x] Desativada autoaprovação por From (commit cd05e0ad); novo fluxo de integração comprova revisão humana autenticada antes de criar evento.
- [x] 40 casos adversariais adicionais + 48 cenários de benchmark rotulado sintético x5.
- [x] npm ci, npm audit, build, typecheck, testes, smoke, benchmarks, secret scan por GitHub Actions.
- [x] No CI de 2026-11-14, **152 testes aprovados e 0 falhas** no commit cd05e0ad79faed94174bca7f82d22128e8821693 e novamente verificar CI da cabeça atual.
- [x] Artifact privado criado via git archive, testado unzip -t, SHA256SUMS.txt e presença de package-lock e migration 0017; retido temporariamente (7 dias), sem publicação pública.
- [x] package.json e lockfile possuem 2.4.0-rc.1; documentação de limites e custos.
- [x] Nenhum merge, deploy, release pública, inclusão de segredo nem alteração de cobrança realizada pela missão.

## Pendências que NÃO podem ser declaradas concluídas

- [x] Eliminar autoconfirmação baseada apenas no campo From: a 2.4 **ignora** o modo legado trusted-senders e exige revisão humana autenticada para todo evento. Uma nova autenticação real do remetente seria uma capacidade futura separada.
- [ ] Testar OAuth consentido Gmail e Microsoft real, inclusive políticas institucionais.
- [ ] Migrar D1 real após backup e restauração isolada e verificar integridade.
- [ ] Medir CPU Worker, rows D1, cota/subrequests, quotas e latência p95/p99.
- [ ] Homologar Android, iOS, desktop, Web Push, instalação e acessibilidade com pessoas.
- [ ] Construir/validar corpus real consentido PT-BR e taxa de falso negativo, não só benchmark sintético.
- [ ] Verificar revogação completa OAuth e todos os estados de recuperação remota de calendário.
- [ ] Resolver/retestar os pontos F05, F06, F07, F08, F09 e F10 conforme escopo de release pública; F01 mitigado por revisão obrigatória (sem autoconfirmação).
- [ ] Decisão humana explícita de merge e, separadamente, deploy/publicação, caso desejados.

## Status da release candidate

**GO: review offline e teste interno com dados simulados. NO-GO: homologação final, lançamento e automação com remetente não autenticado.** Não interpretar ZIP ou CI verde como autorização de distribuição pública.

## Como obter o ZIP privado
Em https://github.com/kelwin-feitosa/Aurora/actions, abrir execução mais recente aprovada de Quality gates na branch feature/aurora-2.3, seção Artifacts: Aurora-2.4.0-rc.1-private. O arquivo baixado do Actions é um wrapper contendo ZIP-fonte, SHA256SUMS, verificação e benchmarks. Validar o SHA do **ZIP interno** conforme SHA256SUMS. Artifact pode expirar; baixar antes da retenção de 7 dias. Quem não tem permissão no repo não pode acessar.
