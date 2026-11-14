# Aurora 2.0 — Pesquisa científica, GitHub e reutilização legal

## Método e proveniência

Inspeção local do código 1.6 e documentação 0.3; leitura de código público pelo conector GitHub (não houve clone remoto, execução de código de terceiros nem auditoria completa de cada repositório). Data da pesquisa: 12/11/2026 (America/Sao_Paulo). Fontes oficiais verificadas durante a missão; parâmetros podem mudar.

| Fonte | Evidência que fundamenta a decisão | Uso no Aurora |
|---|---|---|
| [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) | Workers Free: 10 ms CPU/invocação; 50 subrequests externos por invocação; 100.000 requisições/dia | Orçamentos conservadores, operação em etapas e exigência de medição real |
| [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/) | 50 consultas D1 por invocação Free; Time Travel de 7 dias | Contar comandos dentro de `batch`, separar manutenção pesada, backups independentes |
| [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) | Free: 5 milhões de linhas lidas/dia e 100 mil escritas/dia; limites aplicáveis à conta | Monitorar linhas, não apenas contagem de comandos, e não prometer custo zero |
| [Gmail incremental sync](https://developers.google.com/workspace/gmail/api/guides/sync) | `historyId` expira; 404 exige ressincronização | Preservar bootstrap + delta/checkpoints |
| [Microsoft Graph mail delta](https://learn.microsoft.com/en-us/graph/delta-query-messages) | Delta é por pasta, `nextLink` e `deltaLink` opacos e reutilizáveis | Validar URLs rigorosamente; não inferir cobertura de outras pastas |
| [EASE, IEEE Access (2026)](https://doi.org/10.1109/ACCESS.2026.3723800) | Avaliação de prompt injection em agentes de e-mail deve verificar efeitos reais, não só saídas intermediárias | Testar APIs e mutações, não apenas classificação textual |
| [Prompt Injection Detection for Email Agents (2026)](https://arxiv.org/abs/2609.30657) | Defesas devem combinar estágios do ataque e consistência com ações autorizadas | Separar e-mail não confiável da capacidade de emitir ações |

## Repositórios auditados por leitura localizada

| Repositório | Código/licença observados | Decisão |
|---|---|---|
| [annazeng/email-to-calendar](https://github.com/annazeng/email-to-calendar) | `src/deduplication.py` SHA `7d429cec2f518d787ffe80ff3e4dccac3a646d5c`; MIT. Similaridade alta de título sem vinculação obrigatória ao tempo poderia mesclar provas distintas | **Não copiar** deduplicação por similaridade; manter identidade por fonte/tempo/propriedade remota |
| [postalsys/postal-mime](https://github.com/postalsys/postal-mime) | `LICENSE.txt` SHA `d03231f884e13dba8f76844dddb6308e75a8a54e`; licença tipo MIT; parser robusto MIME, compatível com Workers segundo docs | Não adotar neste ciclo sem benchmark real de bundle/CPU nem lockfile; reforçado teto de traversal/truncamento nativo |
| [kewisch/ical.js](https://github.com/kewisch/ical.js) | `LICENSE` SHA `a612ad9813b006ce81d1ee438dd784da99a54007`, MPL-2.0 | Não incorporar: subconjunto .ics de revisão já atende ao escopo; RRULE completa elevaria risco/complexidade |
| [wanasit/chrono](https://github.com/wanasit/chrono) | `LICENSE.txt` SHA `cadd431c519954cc7efeb1d9dd14f602893302e3`, MIT; parser de datas | Não substituir parser PT-BR sem corpus rotulado independente e medição de bundle |
| [n8n-io/n8n](https://github.com/n8n-io/n8n) | Sustainable Use License e módulos Enterprise | Não incorporar dependências/licenças restritivas ao produto individual |
| [activepieces/activepieces](https://github.com/activepieces/activepieces) | Core MIT, diretórios comerciais segregados | Não incorporar servidor completo: custo de implantação inadequado à meta Free-first |

## Engenharia reversa lícita aplicada

Somente **análise de interfaces, comportamentos e padrões públicos**. O código novo implementado nesta missão é autoral; nenhum trecho de terceiros foi copiado para o projeto. Foram identificados padrões úteis: identidade estável, outbox, observação de operações remotas, entrada limitada em bytes, parser conservador e testes com falhas de rede. Não se fez bypass de acesso, descompilação proprietária, coleta de dados privados ou varredura intrusiva.

## Resultados científicos e limites

O corpus artificial `bench/corpus-2.0.jsonl` tem 68 mensagens construídas por modelos de casos, com rótulo de autorização automática baseado em remetente e clareza temporal. **Não** é amostra natural, não testa SPF/DKIM, nem estima precisão em usuários reais. `npm run bench:scientific` mede decisões de criação automática, **não** acerto semântico geral. Os resultados não justificam afirmar “100% seguro/preciso”; em particular, o `From` pode ser falsificado.

## O que foi rejeitado por ausência de ganho comprovado

Migração para microserviços; Redis, Kafka e filas pagas; importação indiscriminada de parsers externos; LLM paga; automação irrestrita sobre qualquer e-mail; web push com backend adicional; desativar verificações de propriedade para diminuir chamadas. Esses itens elevariam risco, custo ou complexidade sem medição favorável no contexto real do Aurora.
