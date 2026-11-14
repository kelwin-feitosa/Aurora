# Aurora 2.0 — Benchmarks reproduzíveis, consumo e limites

**Ambiente de execução:** Node.js v22.16.0, `node:sqlite`, localhost, corpus inventado. Não é Cloudflare Workers nem D1 remoto. As medidas não podem ser extrapoladas para CPU, memória em edge, quotas mensais ou precisão com correspondência institucional.

## Orçamento de SQL no mesmo cenário (primeiro ciclo)

| Métrica | Aurora 1.6 (instrumentação corrigida) | Aurora 2.0 | Variação |
|---|---:|---:|---:|
| Comandos SQL, inclusive comandos internos de `DB.batch` | 44 | 37 | **-7 / -15,9%** |
| Comandos SQL, segundo ciclo | 37 | 35 | -2 / -5,4% |
| Requisições externas do primeiro ciclo | 6 | 6 | 0% |
| Ciclo duas contas, SQL por ciclo alternado | Independente do número total de contas no teste | 37 e 35 | não mede backlog real |

A medição anterior da 1.6 não incluía todas as instruções executadas dentro de `batch`; a comparação acima usa a mesma instrumentação corrigida nos dois estados. O benchmark evita recontar um comando do batch apenas como uma única query. **Mesmo 37/50 não garante 10 ms de CPU, limite de subrequisições ou capacidade para o pior caso.**

Com duas contas em cenário de revisão sem escrita remota, a 2.0 executou **25 comandos SQL** no primeiro ciclo e **23** no segundo, com 3 e 5 chamadas externas, respectivamente. Os casos usam mensagens curtas e verificações simuladas.

## Microbenchmark local, 2.0

| Operação | Amostras | Mediana | p95 | p99 |
|---|---:|---:|---:|---:|
| Classificação | 3.000 | 0,006 ms | 0,0105 ms | 0,0611 ms |
| Inserção SQLite | 1.000 | 0,0159 ms | 0,0255 ms | 0,0560 ms |
| Consulta por índice SQLite | 1.000 | 0,0052 ms | 0,0079 ms | 0,0430 ms |
| AES-GCM ida/volta | 150 | 0,1604 ms | 0,4543 ms | 0,8245 ms |

Resultados de uma execução local (`EVIDENCIAS_2.0/runtime_2_0.json`) com RSS ~81MB do processo Node incluindo todo runtime; não é custo de memória do Worker e não é benchmark de throughput máximo. Repetir em hardware variado e registrar distribuição e warmup antes de inferir ganho generalizável.

## Avaliação artificial de política de automação

`bench/corpus-2.0.jsonl`: 68 mensagens sintéticas, rótulo **“autorizar automaticamente?”**, e não “evento detectado corretamente?”.

| Política | Verdadeiros positivos | Falsos positivos | Verdadeiros negativos | Falsos negativos |
|---|---:|---:|---:|---:|
| Automação anterior, sem confiança de remetente | 18 | 26 | 24 | 0 |
| Nova política com allowlist explícita | 18 | **0** | 50 | 0 |
| Nova política padrão “revisão” | 0 | **0** | 50 | 18 |

A melhora de falso positivo é resultado **lógico da política de permissão projetada e do corpus criado em torno dela**. O modo revisão aceita recall automático zero deliberadamente, para privilegiar segurança. Não extrapolar para precision/recall em e-mails reais, SPF/DKIM, classificações complexas, ataques ou qualidade de extração acadêmica. O campo From pode ser falsificado; a allowlist é um opt-in de risco. O corpus serve como **regressão técnica**, não evidência científica de eficácia generalizável.

## Free-tier: limites e observabilidade requerida

Fontes atuais: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) e [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). Revalidar na data de deploy.

- Worker Free: 10 ms CPU por execução, 50 subrequests externos por execução, ~100.000 requisições/dia na cota global do serviço.
- D1 Free: 50 consultas por execução em Workers, 5 milhões de linhas lidas/dia, 100 mil linhas escritas/dia e armazenamento grátis limitado (ver docs oficiais); consultas são um limite diferente de subrequests/CPU.
- Contadores internos de API **não** contabilizam todas as fontes de consumo (OAuth setup, UI, filas de navegador, D1 rows). Não chamar “R$ 0 garantidos” o que só foi testado por simulação.

### Gate para custos reais

Implantar uma instância sob controle do usuário, exercitar por pelo menos vários dias e registrar p50/p95/p99 de CPU, quantidade de D1 queries por invocação incluindo `batch`, subrequests, rows read/write e backlog após 5, 25, 100 e 500 mensagens/dia. Fazer soak e falhas de rede/cursor. Reduzir `SYNC_LIMIT` e fatiar etapas se houver margem inadequada. Interromper operações ao detectar risco de quota; não migrar automaticamente para plano pago.

**Reprodução:** `npm run bench:d1`, `npm run bench:multi`, `npm run bench:scientific`, `npm run bench`. Conferir logs brutos, especialmente os históricos incluídos no dossiê. 
