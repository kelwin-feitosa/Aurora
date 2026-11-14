# Benchmark sintético de triagem por metadados — Aurora 2.3

Reproduzir: `npm run bench:monitoring` (Node >=22, sem rede). Não é benchmark de Cloudflare, provedores reais nem acurácia em corpus acadêmico humano.

## Cenário controlado

Mensagens geradas com duas categorias triviais: `Prova 18/11/2026` e `Cupom desconto exclusivo`, remetentes fictícios. O script mede tempo da regex apenas e modela GETs. Não inclui listagem, histórico, anexos, token refresh, banco ou índices.

| Taxa de mensagens relevantes | GETs anteriores / 100 | GETs novos / 100 | Corpos lidos (anterior → novo) | Unidades Gmail (anterior → novo, modelo) |
|---|---:|---:|---:|---:|
| 10% | 100 | 110 | 100 → 10 | 6.000 → 2.600 |
| 40% | 100 | 140 | 100 → 40 | 6.000 → 4.400 |
| 75% | 100 | 175 | 100 → 75 | 6.000 → 6.500 |

**Conclusão:** o método reduz leitura de corpo para casos descartados e pode reduzir unidades Gmail quando menos de ~66,7% das mensagens passam pelo filtro. **Ele aumenta GETs sempre que há mensagens relevantes**; não é uma otimização universal. No Graph, que não usa a mesma tabela de unidades Gmail, a vantagem de custo de API está **não comprovada**. É preciso testar com dados consentidos e processar poucos itens por invocação no Workers Free.

Valores Gmail conforme documentação oficial atual: `messages.get(metadata)` 20 unidades e `messages.get(full)` 60 (revisão de maio/2026). Fonte: https://developers.google.com/workspace/gmail/api/reference/quota . O projeto não tem como garantir preço futuro. Sobre o endpoint metadata: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get .

## Comparabilidade e invariantes

Os 98 testes da 2.2 devem continuar verdes. O benchmark da 2.2 com 37 SQL/6 chamadas externas não pode ser comparado diretamente com a nova triagem quando o perfil de mensagens mudou. Os testes `tests/monitoring.test.mjs` verificam explicitamente **zero leitura de corpo** no Gmail e Outlook simulados para mensagens descartadas. A consulta adicional a `connection_monitoring`, `monitoring_skips` e ao registro de contagem custa D1; medir em Cloudflare antes de ativar para usuários reais. Resultados obtidos em Node local não provam tempo CPU Workers.
