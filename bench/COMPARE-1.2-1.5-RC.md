# Benchmark local 1.2 → 1.5 RC

Testes executados em 12/11/2026 no mesmo ambiente Node.js v22.16.0, SQLite nativo. São microbenchmarks isolados, **não** medições de CPU Cloudflare ou precisão clínica/acadêmica real. Diferenças pequenas entre rodadas não provam regressão/melhoria estatística.

| Operação | N | p50 1.2 (ms) | p50 1.5 (ms) | p95 1.2 (ms) | p95 1.5 (ms) |
|---|---:|---:|---:|---:|---:|
| classificação PT-BR | 3000 | 0.0058 | 0.0057 | 0.0101 | 0.0062 |
| inserção SQLite | 1000 | 0.0134 | 0.0124 | 0.0261 | 0.0218 |
| consulta por índice | 1000 | 0.0050 | 0.0051 | 0.0075 | 0.0066 |
| AES-GCM ida e volta | 150 | 0.1567 | 0.1977 | 0.4908 | 0.5107 |

## Medidor sintético de comandos SQL

O medidor simulado contou **36 comandos no ciclo 1** (1 ou 2 contas) e **35 no ciclo 2** com duas contas. Uma execução agendada completa da 1.5 também acrescenta até duas gravações de estado do cron; o limite Free do D1 não foi testado em Cloudflare. Medição real de CPU, subrequisições e linhas D1 continua obrigatória.

## Frontend

O comando `npm run audit:pwa` contabilizou **18.100 bytes gzip** somados para HTML, CSS, JS, service worker, manifesto e instalador (arquivos isolados, sem comprimir cabeçalhos HTTP ou contabilizar ícones PNG). O total da primeira carga real depende do navegador, cache, conexão e recursos carregados. Não é pontuação Lighthouse.

## Reproduzir

```bash
npm run build
npm run bench
npm run bench:d1
npm run audit:pwa
```

Resultados brutos: `bench/results-1.2-measured.json` e `bench/results-1.5-measured.json`. O benchmark 1.2 foi executado após extrair uma cópia íntegra do pacote original. Esses dados não equivalem a inferências sobre confiabilidade em produção.
