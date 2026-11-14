# Benchmark antes/depois e limites

## SQL e chamadas (mesmo cenário local)

| Medida | Aurora 2.0 | Aurora 2.2 | Observação |
|---|---:|---:|---|
| D1 statements simulados ciclo 1 (1 conta) | 37 | 37 | Sem mudança no volume por evento |
| D1 statements simulados ciclo 1 (2 contas) | 37 | 37 | Sem mudança |
| D1 statements simulados ciclo 2 (2 contas) | 35 | 35 | Sem mudança |
| Chamadas externas primeiro ciclo | 6 | 6 | Mock, não rede real |
| Tamanho total gzip dos assets PWA | verificar registro 2.0 | ~21,2 KB | Acrescentou UI e SW, sem otimização volumétrica afirmada |

O cron adicional registra duas operações em `runtime_state` fora do contador do script `bench:d1`; um Worker implantado deve medi-las por invocação no painel oficial. Cada Worker Free tem limite de CPU de 10 ms e de consultas D1 por invocação; não converter tempo Node em CPU real.

## Filas sintéticas 30 dias, mesmo fluxo de chegadas por seed

Arquivo `bench/bench-schedule-2.2.py` implementa baseline 15min vs 3min em backlog/15min ocioso. É modelo otimista: conhece a fila remanescente no servidor (na API real esse sinal depende de `nextPage`), assume custo simplificado de 1 chamada para polling vazio/2 para mensagem, aplica travas estimadas de 500 chamadas e 200 leituras por dia, não modela D1/CPU/rede; atrasos são sintéticos. **Não é experimento de Cloudflare, Gmail nem Graph.**

| Contas; e-mails/dia/conta | Antigo backlog | Novo backlog | Antigo p95 (min) | Novo p95 (min) | Custo de provider_calls antes→depois (30d) |
|---|---:|---:|---:|---:|---:|
| 2 × 50 | 158 | 0 | 3.996 | 12 | 5.744 → 9.349 |
| 2 × 100 | 3.155 | 70 | 21.552 | 579 | 5.758 → 14.690 |
| 2 × 200 | 9.291 | 6.170 | 31.041 | 20.016 | 5.759 → 15.000 |

**Trade-off:** menor atraso com MAIS chamadas de API, e alto volume permanece inviável. Atenção a 20% dos cron jobs perdidos no `results-schedule-2.2.csv`. Não promover otimização sem verificar dados reais de quota e uso típico.

Arquivos brutos: `bench/results-schedule-2.2.csv` e `.json`, `bench/measure-d1-queries.mjs`, `bench/measure-multi-queries.mjs`. Valores reais futuros deverão registrar p50/p95/p99 de atraso, uso de CPU em Workers, D1 queries/rows, gastos e sinal de cursor expirado.
