# Aurora 2.4 — registro de achados adversariais (2026-11-14)

**Escopo:** PR #1, branch feature/aurora-2.3, integração Gmail/Graph, D1, OAuth, PWA, Web Push, triagem, calendário e instalador. **Não houve pentest remoto, acesso a contas institucionais, deploy, merge ou teste em dispositivos reais.** A prioridade é integridade dos dados e fail-closed, não número de funcionalidades.

## Achados classificados

| ID | Prioridade | Evidência verificável | Estado / decisão |
|---|---|---|---|
| F01 | P1 / ABERTO | src/domain/trust.ts: allowedAutomaticSender aceita apenas o campo From e uma allowlist configurada. Cabeçalho não constitui SPF/DKIM/DMARC confiável. | **NO-GO se AUTO_APPROVE_MODE=trusted-senders**. Manter configuração review; não afirmar que sender foi autenticado. Uma solução real precisa prova do provedor ou confirmação humana para todo evento. |
| F02 | P2 / CORRIGIDO | O botão rescan não superava o mesmo filtro que originou o descarte. | Migração 0017, flag durável de leitura única, seleção apenas de descartes não protegidos; teste de reavaliação + opt-out. Commit 96aea465. |
| F03 | P2 / CORRIGIDO | unsubscribePush/listPush ignoravam session_hash fornecido. | WHERE session_hash na listagem/revogação de autorização do aparelho; revogação total de sessão continua possível pela API. Commit 8011f3e8. |
| F04 | P2 / CORRIGIDO | Outlook fazia GET de metadados mesmo com cabeçalhos já presentes na página delta. | Reaproveita só na memória da rodada, pede from no $select e recua ao endpoint antigo se delta não trouxer campos. Commit f5086421. |
| F05 | P1 / NÃO COMPROVADO | Workers Free limita CPU a 10 ms e D1 tem limites de linhas; contadores internos não são medição da fatura, CPU real ou RUs. | Não declarar 12 meses gratuitos; aferir Cloudflare real com telemetria e alarmes. |
| F06 | P1 / NÃO COMPROVADO | Google OAuth Gmail e Microsoft Entra podem exigir verificação/consentimento institucional. | Homologação externa com contas autorizadas, sem credenciais no repositório. |
| F07 | P2 / ABERTO | triageEnvelope marca assunto genérico como uncertain e não busca corpo por padrão. | Falso negativo conhecido; rescan manual corrige casos selecionados, mas não elimina perda automática. Validar recall com corpus consentido antes de ampliar implantação. |
| F08 | P2 / ABERTO | src/providers/gmail.ts / outlook.ts assumem fuso e duração local específicos em gravação de eventos. | Testar fusos, horário de verão, eventos all-day e horário institucional. |
| F09 | P2 / NÃO COMPROVADO | PWA e Web Push têm diferenças entre browsers/OS; push aceito pelo gateway não prova exibição. | Matriz real Android/iOS/desktop e quiet hours com horário local. |
| F10 | P2 / NÃO COMPROVADO | Restauração D1 Cloud e migrações sob volume real não foram testadas. | Fazer backup, testar restauração em banco isolado e validar FK/contagens antes de deploy. |
| F11 | P2 / NÃO COMPROVADO | Classificação, ICS e MIME têm corpora sintéticos e limites conservadores. | Medir precisão/recall/abstenção e testes contra fontes consentidas. |
| F12 | P3 / OBSERVAÇÃO | docs/KNOWN_LIMITATIONS.md e docs/SECURITY.md contêm histórico de versões antigas. | Usar documentos 2.4 como fonte da candidata; atualizar históricos somente com revisão contextual. |
| F13 | P3 / ALERTA | GitHub Actions usa versões @v4 de ações que recebem aviso de runtime Node 20 obsoleto. | Reavaliar atualização/pinning em etapa separada; CI ainda passa. |

## Evidência de correções
- Código/testes: commits 96aea465, 8011f3e8, f5086421, 39ca18b5, 48f18781.
- 2.4: 40 casos adversariais adicionais em tests/adversarial24.test.mjs; são **casos sintéticos**, não prova de resistência a ataques desconhecidos.
- GitHub Actions privado, runs associados a cada commit, é a evidência de build, testes e ZIP; não confundir com prova de implantação.

## Regras de liberação
1. **NO-GO institucional** enquanto F01 ativo na configuração, F05/F06/F09/F10 sem homologação.
2. **GO para ensaio offline** com dados simulados e modo de revisão humana.
3. Nenhum achado resolvido por mera promessa, popularidade de biblioteca ou mudança cosmética.
4. Não realizar merge, deploy, divulgação pública nem alterações de cobrança sem autorização explícita.
