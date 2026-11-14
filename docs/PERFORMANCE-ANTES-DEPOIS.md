# Performance Aurora 2.4 — modelos e evidências (sem extrapolação indevida)

## Experimento reproduzível

No checkout da cabeça: npm ci; npm run bench:monitoring24; npm run bench:d1; npm run bench:multi; npm test. Node >=22, sem rede nos benchmarks. CSV e JSON dos 48 cenários x5 repetições são salvos na pasta artifacts e preservados temporariamente pelo GitHub Actions. Dataset é sintético: duas classes de assunto reconhecível/promocional e porcentagem configurável de assunto genérico relevante. **Não é precisão real sobre e-mails humanos.**

### Custo teórico Google Gmail — alteração de maio de 2026
Fonte oficial: https://developers.google.com/workspace/gmail/api/reference/quota
- GET messages.get em formato full: **60 unidades**.
- GET messages.get em formato metadata: **20 unidades**.
- Se n mensagens e r lidas por triagem: baseline teórico full = 60n; triagem = 20n + 60r (sem messages.list/history, anexos, refresh, falhas).
- Triagem só economiza unidades da API Gmail se **r/n < 2/3**. Aumenta número total de requests de n para n+r, ainda que reduza corpos baixados.
- Exemplo n=100, relevância=25%, zero assunto genérico: baseline 6.000, triagem 3.500 unidades, 25 corpos.
- Mesmo cenário com 25% dos relevantes usando assunto genérico: baseline 6.000, triagem 3.140 unidades, **6 falsos negativos de 25 casos relevantes** no workload sintético. Economia sem recall não deve ser vendida como sucesso.
- Quando 75% são lidos, cenário não ambíguo: baseline 6.000, triagem 6.500 unidades; há regressão na cota por mensagem. Logo o filtro é decisão de privacidade e custo variável, não otimização universal.

### Microsoft Graph
Referência https://learn.microsoft.com/en-us/graph/delta-query-messages . Resposta delta pode conter subject, from e receivedDateTime via $select; antes havia um fetch adicional de cabeçalho por mensagem e depois um fetch completo quando lida. Agora a linha de fetch de metadados é eliminada **quando os campos estão presentes no delta da rodada corrente**. Se um token antigo não trouxer campos, fallback preserva compatibilidade. Não é estimativa de dinheiro: o Graph tem regras próprias de throttling, sem conversão comprovada das chamadas em custo.

### SQL e Free tier
GitHub Actions em 2026-11-14 mediu via adaptador SQLiteD1 sintético:
- 1 conexão, primeira rodada: **39 instruções SQL**, 7 chamadas de provedor (mock).
- 2 conexões, primeira rodada: **39 instruções SQL**, 7 chamadas de provedor (mock).
- 2 conexões, segunda rodada: **37 instruções SQL**, 13 chamadas de provedor acumuladas.
- Cenário de triagem promocional: 22 instruções na primeira rodada e 20 na segunda, conforme testes bench:multi.
Não confundir contagem de instruções com linhas lidas/escritas D1, CPU ou custo Cloudflare.

Cloudflare Workers Free em 2026-11-13: 100.000 requests/dia, 10 ms CPU e 50 subrequests/request (https://developers.cloudflare.com/workers/platform/limits/). Cloudflare D1 Free: 5 milhões rows read/dia, 100.000 rows write/dia e 5 GB total (https://developers.cloudflare.com/d1/platform/pricing/). Desde setembro de 2026 há enforcement dos limites diários (https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/).

### Critério para otimização definitiva
Executar amostra consentida rotulada, mesma máquina e versionamento para A/B, p50/p95/p99 de latência, CPU real Worker, quotas D1 reais, número de e-mails corretamente reconhecidos e falsos negativos; comparar antes/depois por cenário e rejeitar avanço se segurança, recall ou custo piorarem de modo relevante. Resultados offline **não comprovam** custo mensal zero nem 12 meses Free.
