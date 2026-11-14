# Ledger de evidências — Aurora 1.2

| ID | Requisito | Implementação | Teste / comando | Ambiente | Resultado | Estado | Lacuna |
|---|---|---|---|---|---|---|---|
| E01 | Nenhum visitante acessa dados | `web/handler.ts` | `npm test` — rotas privadas | Node22/SQLite local | HTTP 401 sem sessão | TESTADO_INTEGRADO_LOCAL | Cloudflare real |
| E02 | Proteção de sessão/CSRF | `infra/security.ts` | `npm test` — login, origem | Node22 | PASS | TESTADO_OFFLINE | navegador E2E |
| E03 | Tokens não ficam em claro | `infra/crypto.ts` | AES-GCM AAD, tamper e export | Node22 | PASS | TESTADO_OFFLINE | auditoria de produção |
| E04 | PKCE e state de uso único | `providers/oauth.ts` | fluxo OAuth simulado | Node22/SQLite | PASS | TESTADO_INTEGRADO_LOCAL | OAuth real |
| E05 | Gmail incremental + calendário | `providers/gmail.ts` | teste integração do fake Gmail | Node22/SQLite | PASS | TESTADO_INTEGRADO_LOCAL | acesso Gmail real |
| E06 | Outlook delta + calendário | `providers/outlook.ts` | teste integração do fake Graph | Node22/SQLite | PASS | TESTADO_INTEGRADO_LOCAL | tenant/conta autorizados |
| E07 | Idempotência após POST perdido | `app/pipeline.ts` | rede falha depois de criar | Node22/SQLite fake | PASS, 1 POST | TESTADO_INTEGRADO_LOCAL | API real/latência |
| E08 | Token/resumo sem corpo completo | `store.ts` / `handler.ts` | export sanitizado | Node22 | PASS | TESTADO_OFFLINE | revisão LGPD |
| E09 | Data ambígua não autoriza evento | `domain/classifier.ts` | datas relativas, conflitos, data inválida | Node22 | PASS | TESTADO_OFFLINE | corpus real |
| E10 | Planos Free/limites | `wrangler.jsonc` | consulta documental oficial | Web em 12/11/2026 | Parâmetros verificados, CPU não medida | DOCUMENTADO | deploy/observabilidade real |
| E11 | Microbench de operações | `bench/benchmark.mjs` | `npm run bench` | Node22/SQLite local | `bench/results.json` | TESTADO_OFFLINE | não transpor para D1 |
| E12 | Instalação para leigo | `INSTALAR_AURORA.html` | revisão estática do assistente | Local | gerador de secrets e link oficial implementados | IMPLEMENTADO_NÃO_TESTADO | validação com estudante e hospedagem |
| E14 | Backup/restore local cifrado | `scripts/backup-local.mjs`, `restore-local.mjs` | backup AEAD → prévia → restauração com isolamento e desabilitação de conexões, em SQLite temporário | Node22/SQLite local | PASS | TESTADO_LOCAL_MANUAL | automação CI + D1 real |
| E13 | CI | `.github/workflows/quality.yml` | não executado no GitHub | Nenhum | pendente | IMPLEMENTADO_NÃO_TESTADO | dependências/lockfile/Actions |

*Estados não representam resultados de produção. Ações com contas institucionais, nuvem e usuários reais precisam de autorização explícita.*

## Missão 1.2 — evidências novas

| ID | Afirmação limitada | Evidência reproduzível | Resultado | Estado |
|---|---|---|---|---|
| E15 | Cookie roubado não funciona após logout | `npm test` + `npm run smoke:http` | revogação hash no DB, resposta 401 | TESTADO_LOCAL |
| E16 | OAuth state não pode ser concluído por sessão diferente | `npm test` teste cross-session | callback de segunda sessão rejeitado | TESTADO_MOCK |
| E17 | Correções/cancelamentos manuais não afetam eventos alheios | `npm test` Gmail/Graph `readOwnedEvent` | marcador correto obrigatório | TESTADO_MOCK |
| E18 | Resposta perdida após PATCH não gera PATCH duplicado | `npm test` | reconciliou após perda simulada | TESTADO_MOCK |
| E19 | Tentativas externas são contabilizadas inclusive falhas | `npm test` metered HTTP | limite por ciclo aplicado e contagem de tentativa | TESTADO_LOCAL |
| E20 | Falha persistente não gera retries infinitos | `npm test` cinco falhas | fila estacionada após cinco tentativas | TESTADO_MOCK |
| E21 | Migrações 1.1 → 1.2 preservam dados | `npm test` SQLite temporário | registro legível após aplicação 0006–0009 | TESTADO_LOCAL |
| E22 | Backup/restauração cifrados preservam isolamento | execução controlada em pasta temporária, `backup-local.mjs` + `restore-local.mjs` | restore `enabled=0` e `calendar_changes.state=blocked` | TESTADO_LOCAL_MANUAL |
| E23 | D1 por ciclo tem orçamento sintético inferior a 45 | `npm run bench:d1` | 36 consultas (ciclo 1), 35 (ciclo 2) em 2 contas alternadas | SINTÉTICO_NÃO_CLOUD |
| E24 | HTTP de verdade (localhost) | `npm run smoke:http` | login/dados/logout e cookie revogado | TESTADO_HTTP_LOCAL |
| E25 | Higiene de segredos no pacote | `npm run security:check` | sem `.dev.vars`, `.env`, banco ou chave no checkout | VERIFICAÇÃO_BÁSICA_NÃO_SAST |
| E26 | Cloudflare/Google/Microsoft reais | acesso indisponível | NÃO EXECUTADO | BLOQUEADO_EXTERNO |

**Atenção:** os benchmarks locais/contadores sintéticos não comprovam o limite de CPU 10 ms, a quota real de subrequests, a disponibilidade contínua ou a segurança de uma instalação pública.
