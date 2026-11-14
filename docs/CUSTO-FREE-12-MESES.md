# Aurora 2.4 — custo e viabilidade Free por 12 meses (análise, NÃO garantia)

Data: 2026-11-14. Horizonte solicitado: 2026-11 até 2027-10. Todas as projeções são cenários, não preço contratado, fatura verificada ou garantia de que políticas permanecerão iguais. **Não foram consultadas contas de faturamento do usuário; nenhuma cobrança foi alterada.**

## Fontes oficiais e limites atuais

- Cloudflare Workers Free (documentação atualizada em 13/11/2026): 100.000 requests/dia, 10 ms CPU por request/cron, 50 subrequests por invocação. https://developers.cloudflare.com/workers/platform/limits/
- D1 Free (out/2026): 5 milhões rows read/dia, 100 mil rows written/dia, 5 GB storage total. https://developers.cloudflare.com/d1/platform/pricing/
- Desde 01/09/2026 D1 faz enforcement e interrompe consultas quando o limite diário de linhas é ultrapassado. https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/
- Gmail API: quotas atualizadas em 01/05/2026, metadata 20 unidades, full 60, list 5 e history.list 2. O limiar diário de faturamento por projeto anunciado é 80 milhões de unidades; preço e evolução posterior não podem ser inferidos como fixos. https://developers.google.com/workspace/gmail/api/reference/quota
- Microsoft Graph: limites e retries governados por throttling (429/Retry-After), não existe equivalência de custo por unidade Gmail. https://learn.microsoft.com/en-us/graph/throttling

## Cenário de referência por instalação (hipótese)

- Cron a cada 15 min = 96 invocações/dia (não medir como requisições HTTP de usuários; triggers também usam CPU).
- Um mailbox ativo atendido por ciclo, até 1–2 mensagens por ciclo conforme configuração SYNC_LIMIT, com budget interno de 16 chamadas ao provedor/ciclo e reserva diária de 500 chamadas.
- Se hipoteticamente houver 100 mensagens novas/dia com 25% dos assuntos reconhecidos, o modelo de Gmail exige 100 GET metadata + 25 GET full, consumindo 3.500 unidades em vez de 6.000 por GET full, sem considerar list/history, anexos, retries ou refresh.
- O sistema pode perder mensagens relevantes com assunto genérico; a economia não compensa perda de recall. Não existe economia absoluta quando mais que 2/3 dos itens precisa de full read.
- D1 offline mediu 39/37 **instruções SQL por rodada sintética**; isso NÃO representa rows read/write, latência ou CPU. Sem Cloudflare real não é válido multiplicar por 96 e concluir que está dentro do Free.
- Gmail projeto e limite são compartilhados por instalações que usam mesmo app OAuth. Diversas instalações podem somar consumo, tornando extrapolação por estudante inválida.
- Outros custos potenciais: domínio customizado, autenticação/consentimento institucional, infraestrutura de suporte, alertas, transferência, e tempo operacional, mesmo que CPU/banco coubessem no Free.

## Sensibilidade e risco 12 meses

| Mudança até 2027 | Efeito | Contenção segura |
|---|---|---|
| CPU Worker real excede 10 ms | Execução é terminada, cron pode falhar | Profiling remoto, reduzir trabalho por ciclo, suspender funcionalidades caras |
| Rows D1 excedem cota diária | Consultas D1 falham até reset | Índices, retenção, alertas, evitar repetição infinita |
| Políticas de cobrança Google mudam | Custo inesperado ou bloqueio | Alertas, acompanhamento de anúncio oficial, consentimento antes de mudar plano |
| Usuário tem muitas mensagens | Mais GET, falsa exclusão, backlog | Revisão, configuração clara, rate-limit, sem prometer completude |
| OAuth institucional é negado | Produto não conecta aquela instituição | Exibir bloqueio; jamais contornar regra institucional |
| Push não funciona em aparelho | Avisos não entregues | Preferir calendário confirmado, status de gateway sem alegar delivery |

## Critério GO

Para afirmar que uma instalação cabe no gratuito: observar pelo menos uma janela real consentida que capture tráfego/picos, Cloudflare analytics de CPU/rows/subrequests, quotas Google/Graph e armazenamento, depois reavaliar frequentemente. Para afirmar **12 meses grátis**, seria necessário comprovação contratual/limites estáveis e consumo futuro, indisponíveis. Logo status: **NÃO COMPROVADO; NO-GO para prometer gratuidade**.
