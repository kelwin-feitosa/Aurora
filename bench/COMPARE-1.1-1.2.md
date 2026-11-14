# Comparação local 1.1 → 1.2

**Máquina do ambiente de execução e Node v22.16.0**, com medições realizadas em horários distintos. As amostras a seguir não são testes de CPU em Workers/D1. Valores menores indicam operações mais rápidas; no conjunto medido o novo p50 **não melhorou** para esses microbenchmarks. Nenhum algoritmo de classificação foi alterado de forma relevante nesta missão.

| Operação | 1.1 p50 | 1.2 p50 | Diferença observada |
|---|---:|---:|---:|
| Classificação PT-BR | 0.0057 ms | 0.0101 ms | +77.2% |
| Inserção SQLite | 0.0108 ms | 0.0123 ms | +13.9% |
| Consulta indexada SQLite | 0.0050 ms | 0.0050 ms | +0.0% |
| AES-GCM ida e volta | 0.1705 ms | 0.2070 ms | +21.4% |

As diferenças podem ser explicadas por ruído de medição, carga do sistema e mudanças de ambiente. **Não afirmar regressão estrutural ou ganho de desempenho com essa comparação isolada.** A melhoria validada na 1.2 foi de *limitação de trabalho por invocação*, não da velocidade bruta da regex/criptografia.

## D1 / subrequests — experimento controlado

`npm run bench:d1` usa um adaptador SQLite com contador de comandos executados e provedores HTTP sintéticos, contando cada instrução de `batch` separadamente. Não é instrumentação real do D1. O caso com **1 conta** consumiu **36 consultas SQL simuladas + 6 chamadas HTTP**; com **2 contas** agora processadas por prioridade/round-robin: **36 consultas/6 chamadas no primeiro ciclo; 35 consultas/5 chamadas no segundo**, com 1 inbox processado a cada rodada.

Uma tentativa intermediária de sincronizar 2 contas no mesmo ciclo consumiu 51 comandos SQL sintéticos, motivando o ajuste. O teste final documentado bloqueia regressões acima de 44 comandos neste cenário. **Isso não comprova a margem em cenários adversariais**: Gmail histórico com múltiplos IDs por página, reconexões, falhas, reprocessamento, OAuth expirado ou listas de calendários extensas podem elevar as queries. Free exige no máximo 50 consultas D1 e 10 ms CPU por invocação, conforme documentação oficial https://developers.cloudflare.com/d1/platform/limits/ e https://developers.cloudflare.com/workers/platform/limits/ .

### Trade-off obrigatório

Ao processar **1 conta por cron de 15 minutos**, duas contas conectadas tendem a ser examinadas **aproximadamente a cada 30 minutos**, não a cada 15 minutos, desde que ambas permaneçam habilitadas e não haja erros de rede. Contas adicionais elevam a latência; a prioridade da 1.2 é confiabilidade no plano grátis. Ajustar só depois de monitorar D1/CPU em nuvem.

### Reproduzir

```bash
npm run bench
npm run bench:d1
```

Arquivos de dados: `bench/results-1.1-baseline.json`, `bench/results.json`. O contador de D1 é sintético; relatório de CPU real só pode ser produzido após deploy autorizado em Worker Free.
