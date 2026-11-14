# Orçamento Free-first — Aurora 2.0 (ver também BENCHMARK-2.0.md)

**Fonte oficial:** https://developers.cloudflare.com/workers/platform/limits/ (consultada em 12/11/2026). Workers Free: **100.000 requests/dia, 10 ms CPU por execução, 50 subrequests por execução**; uma instalação individual não tem garantia contratual de uptime ou gratuidade permanente. D1 tem limites próprios: https://developers.cloudflare.com/d1/platform/limits/ . Revalidar antes do deploy.

### Limites aplicados no código

- `Cron` configurado a cada 15 minutos: até 96 execuções/dia e cerca de 2.880/30 dias **se de fato ativado**.
- `SYNC_LIMIT` limita mensagens novas processadas por conexão a 1–2 por execução, padrão 1 quando ausente; **uma conexão por ciclo** (ordem de última sincronização), ordenadas por última sincronização.
- Até **16 tentativas de API de provedor por ciclo**, incluindo erros, e até **500 tentativas de API/dia** na rotina `runCycle` (reserva antes de cada `fetch`).
- Até 200 mensagens efetivamente obtidas por dia; até **30 tentativas de mutação de calendário reservadas** por dia (inclui erros e resultados incertos), para não subcontar consumo remoto.
- Operações pesadas são retomáveis por cursor/outbox, sem IA paga habilitada.
- Mensagens que falham 5 vezes são estacionadas e necessitam de revisão manual. Erros de autenticação relevantes pausam a conexão; sincronização manual tem cooldown de 60 s.

### O que NÃO é contabilizado como cota real

O contador `provider_calls` mede **tentativas da rotina agendada/manual** (Gmail/Graph, token refresh, calendário). Não mede automaticamente a criação de conexão OAuth, login no portal, lines read/written no D1, bytes, uso de CPU, quotas separadas de Google/Microsoft ou eventuais encargos de terceiros. O orçamento não garante permanecer no Free; ao alcançar limite, a aplicação reduz trabalho e informa erros, não migra para plano pago automaticamente.

### Risco importante

**Cloudflare Free: 50 subrequests por execução** e **10 ms de CPU**: chamadas D1 também podem afetar limites e cada operação do Aurora faz várias queries. O limite de 16 tentativas REST **não comprova** caber em 50 subrequests ou 10 ms. Necessário medir com uma implantação Free real e ajustar `SYNC_LIMIT`/divisão em etapas antes de recomendar uso contínuo. O pior caso inclui OAuth refresh, bootstrap de calendários, páginas de histórico e operações em retry.

### Objetivos de medição em nuvem (ainda NÃO realizados)

Medições com zero, 5, 25 e 100 e-mails/dia; p50/p95/p99 CPU, número de subrequests HTTP+D1, linhas lidas/escritas, erros de quota, tamanho do backlog, latência e tempo máximo até aviso na agenda. Definir limite de alerta que deixe margem ampla antes do teto. Custo mensal de IA padrão: zero porque o Aurora não liga nenhum LLM.

**Medições offline:** `bench/results.json` contém apenas Node.js e SQLite nativo. Não extrapolar esses valores para Workers/D1.

**Medição local complementar:** em `npm run bench:d1`, um ciclo com uma conta e 1 mensagem em modo sintético executou 37 comandos SQL e 6 chamadas de provedor; numa instalação com 2 contas, o ciclo seguinte executou 35 comandos SQL e 5 chamadas, com polling alternado. Isso **não mede** D1 remoto ou CPU. Consulte `bench/COMPARE-1.1-1.2.md`.


## Medição Aurora 1.6 (13/11/2026)

Foram adicionadas manutenção periódica de dados e classificação multicomponentes conservadora. Em ensaio local sintético, **um compromisso** teve cerca de **40 comandos SQL no primeiro ciclo e 33 no segundo**, versus 36/35 no baseline 1.5; o primeiro ciclo ficou mais caro por limpeza/checagem de retenção. No cenário sintético **de dois itens em revisão** o ensaio indicou aproximadamente 29/22 comandos SQL, pois não grava eventos remotos automaticamente. Isso não é um ganho universal nem um limite máximo para casos com erros.

Para reproduzir: `npm run bench:d1`, `npm run bench:multi`, `npm run bench`. O novo frontend compactado aumentou modestamente; o script `audit:pwa` informa os bytes efetivamente medidos. **Sem telemetria real de Cloudflare**, a gratuidade operacional mensal permanece hipótese.

**Atualização 2.0:** os comandos SQL dentro de `DB.batch` agora contam individualmente. O ciclo 1.6 medido com esse mesmo critério executava 44, e o 2.0 executa 37, em SQLite local. Política padrão: revisão humana; ciclos com revisão podem ter padrão distinto. Detalhes em [BENCHMARK-2.0.md](BENCHMARK-2.0.md).
