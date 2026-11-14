# Aurora 2.0 — Auditoria adversarial e implementação: relatório de fechamento

**Versão:** `2.0.0-rc.1` — **estado:** candidato técnico **NÃO homologado para produção**.
**Base:** Aurora 1.6 técnica integralmente preservada como referência externa ao código alterado.
**Método:** inspeção de código, experimentos SQLite/Node.js, comparação de arquivos de repositórios públicos via GitHub, consultas a documentação oficial, testes adversariais e CI local. **Não** realizamos pentest, prova de CPU Workers, instalação PWA em dispositivos físicos, OAuth institucional ou revisão legal formal.

## Síntese executiva

- **81/81 testes automatizados passaram**, antes eram 65/65, incluindo 16 novos testes adversariais. Passaram build, checagem de tipos, lint de JS, smoke HTTP, verificação PWA, verificação básica de segredos, testes SQLite e benchmarks locais.
- **SQL por ciclo sintético principal:** corrigindo o contador anterior para incluir comandos em lotes, 44 comandos SQL na base 1.6 vs **37** na 2.0 (**-15,9%**). Segundo ciclo 37 vs **35** (-5,4%). Chamadas externas no primeiro ciclo **6 vs 6**, sem ganho. Cenário não representa carga de produção; não houve medição de CPU do Worker, D1 real ou filas extensas.
- **Segurança:** revisão humana é a configuração padrão antes de qualquer criação automática; reconciliação Google exige marcador de propriedade, Graph bloqueia paginação inconclusiva; JSON remoto com limite de tamanho, rastreamento de texto MIME truncado, bloqueio de data contraditória, política mais segura para filas antigas.
- **Confiabilidade:** reserva atômica antes da mutação do calendário, tratamento de limites por tentativa, backoff por conexão para erros persistentes, manutenção pesada isolada do ciclo de processamento e migrações SQL 0011/0012.
- **Precisão:** avaliação de 68 **mensagens sintéticas projetadas** identifica 26 falsos positivos de autorização automática na política antiga vs zero na nova política com allowlist explícita; isto é resultado de política de aprovação, **não** precisão real de NLP nem proteção autenticada contra spoofing.
- **Release gate falhou por desenho**, pois não há `package-lock.json` obtido de registry, nem D1 real e nem origem pública provisionada. CI também falhará até que um lockfile real exista. Não remover esses bloqueios para anunciar release.

## M0–M5: implementação e evidência

| Marco | Evidência realizada | Estado |
|---|---|---|
| **M0 — baseline** | Extração do ZIP 1.6, preservação, 65 testes originais, `verify_1.6_baseline.log`, traços SQL corrigidos | **Executado localmente** |
| **M1 — pesquisa** | Documentação oficial Cloudflare/Gmail/Graph, artigos de segurança de agentes, GitHub de `email-to-calendar`, `postal-mime`, `ical.js`, `chrono`; decisão de reutilização motivada | **Executado com escopo declarado** |
| **M2 — segurança** | Modificações no código e migrações 0011/0012, 16 testes adversariais adicionais, revisão de riscos residual | **Executado localmente; integrações reais pendentes** |
| **M3 — Free-first** | Instrumentação SQL incluindo `DB.batch`, 44→37, seleção por conexão, backoff, cotas por tentativa e manutenção isolada | **Medido em Node/SQLite; Cloudflare pendente** |
| **M4 — UX/precisão/instalação** | Política review-first, mensagens de diagnóstico na UI, tratamento de MIME truncado, corpus artificial, assistente com configuração segura; PWA prévia preservada | **Executado localmente; UX em dispositivos reais pendente** |
| **M5 — qualidade/release** | `npm run verify`, testes, benchmark, checagem de segredos, relatório, matriz de aceite, instruções de upgrade, ZIP e extração limpa | **Release técnica; gate de produção explicitamente NO-GO** |

## Registro de mudanças relevantes e testes

| Mudança | Arquivos/famílias | Prova local | Contrapartida |
|---|---|---|---|
| Google: propriedade remota na reconciliação | `src/providers/gmail.ts` | Teste com evento estranho e ID colidente | Chamadas reais não testadas |
| Graph: paginação incompleta falha fechada | `src/providers/outlook.ts`, `http.ts` | Testes com `@odata.nextLink`, calendário incorreto e URL maliciosa | Busca pode ser bloqueada para revisão em listas longas |
| OAuth e JSON com limite de bytes | `src/providers/oauth.ts`, `http.ts` | Teste com corpo remoto excessivo | Compressão/proxy real ainda pendentes |
| Política revisão padrão/opt-in | `src/domain/trust.ts`, `pipeline.ts`, setup/diagnóstico | Revisão automática negada; allowlist exata e mensagem hostil | Campo `From` não é prova de autenticidade |
| MIME e texto truncado | `gmail.ts`, `outlook.ts`, classifier | Gmail multipart excessivo, Outlook body longo => revisão | Não há parser RFC822 completo nem validação de anexos arbitrários |
| Cota de mutações com reserva atômica | `store.ts`, `pipeline.ts` | Injeções de falha e limite simulado | Cotas de Google/Microsoft e D1 remotos distintas |
| Backoff por conexão | `pipeline.ts`, `0012_sync_failure_backoff.sql` | Erro de provedor não monopoliza seleções | Aumenta latência de contas em falha |
| Higiene de outbox antigo | `0011_pending_automation_safety.sql` | Teste SQL de migração | Requer revisão antes de publicar operações antigas |
| Instrumentação corrigida | `bench/measure-d1-queries.mjs` | Contagem inclui cada instrução nos lotes | Nunca equivale à métrica observada no Worker |
| `release:gate` fail-closed | `scripts/doctor.mjs`, package, CI | Saída 2 sem lockfile/infra real | Bloqueio permanece aberto |

## Achados priorizados

**P0 resolvido localmente:** Google reconciliação sem propriedade, Graph resultado incompleto tratado como ausente, autorização excessiva de automação padrão, texto truncado sem indicação, ausência de backoff por conta, limites de tentativas de mutação não atômicos.

**P0 pendente externo:** tokens de Gmail/Graph em instituições autorizadas, verificação de comportamento dos provedores e D1 remoto, 10 ms CPU Worker Free por invocação, controle real de subrequisições e D1 rows, acesso ao registry npm para lockfile/SCA, segurança e instalação em dispositivos reais. **Não** simular aprovação nesses casos.

**P1 para manutenção:** classificador PT-BR com corpus humano real rotulado e avaliação independente; autenticação robusta de remetente antes de habilitar allowlist por padrão; parsing MIME e convites `.ics` estendidos sob testes de carga; telemetry de quotas reais sem coletar corpo de e-mail; instalação ainda assistida por consoles oficiais.

## Como reproduzir

```bash
npm run verify
npm run bench:scientific
npm run release:gate
```

Esperado em ambiente **sem D1 configurado nem lockfile**: os dois primeiros passam em Node 22 com dependências pré-instaladas, enquanto `release:gate` **falha corretamente**. Reproduzir a partir de uma instalação limpa depende de gerar e versionar um lockfile legítimo, seguido de `npm ci`.

Logs brutos e comandos de origem estão em `EVIDENCIAS_2.0/` do ZIP. Anomalias e resultados negativos estão preservados, não devem ser ocultados para otimizar o índice de testes.
