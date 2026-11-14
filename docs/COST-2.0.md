# Aurora 2.0 — Custos e riscos do plano Free

O objetivo é operação **preferencialmente sem custo recorrente** por instalação individual, mas não existe garantia universal de R$ 0. O software não requer LLM paga. Cloudflare, Google e Microsoft podem alterar quotas ou negar autorização.

## Modelo de carga

Um cron a cada 15 minutos equivale a cerca de **96 invocações agendadas/dia**, se ativado continuamente; 30 dias ≈ 2.880. A quantidade de subrequisições, consultas, linhas D1, CPU e requisições HTTP externas por cron **não é constante**: depende de OAuth, número de pastas, eventos, backfills, mensagens complexas, erros 429 e mudanças de cursores.

No **cenário sintético limitado** de uma mensagem, 2.0 executou 37 comandos SQL (limite D1 Free documentado: 50 por invocação) e 6 requisições de provedor. Isso representa 74% do teto de contagem de consultas para **aquele cenário apenas**; não é medição total de recursos do Worker. CPU de 10 ms e subrequests não foram medidos em ambiente real. Cenários de pico podem exceder o limite.

A política de revisão por padrão reduz risco de mutações automáticas, mas pode exigir ações manuais do usuário; não garante menor número de chamadas em todos os fluxos.

## Controles práticos

- Limite diário de chamadas ao provedor e mutações de calendário via reserva por tentativa; não contabilizar apenas sucesso.
- Uma conta por cron, `next_sync_at` para falhas, lote pequeno de mensagens, manutenção de banco isolada de processamento normal.
- Não usar serviços de IA paga ou infraestrutura adicional por padrão; sem upgrade automático de plano ou serviços cobráveis.
- Monitorar contas e volume separadamente; não confundir política de segurança com proteção automática contra quotas.

## Métricas a coletar em Cloudflare real antes de lançar

CPU p50/p95/p99, consultas D1/invocação incluindo batches, linhas lidas/escritas por dia, total de requisições Worker/dia, subrequests, erro de quota, tamanho da fila de pendências, horas até o lembrete aparecer e recuperação de operações desconhecidas. Exigir margem conservadora e, se necessário, diminuir tamanho dos ciclos. [Fontes e metodologia](BENCHMARK-2.0.md).
