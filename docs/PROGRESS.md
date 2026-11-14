# Progresso reproduzível — Aurora 1.1

12/11/2026 — Leitura de missão e dossiê 0.3, confirmação de quotas oficiais e escopos. Criada estrutura de monólito modular TypeScript/Worker sem dependências de runtime, migrations D1/SQLite e servidor local de desenvolvimento.

Implementados `domain`, `providers`, `app`, `infra`, `web`, painel PT-BR, OAuth e setup. Corrigido bug "relatório de estágio" interpretado como evento; adicionados estados para datas conflitantes, tasks all-day, calendários por conexão e correlação de avisos repetidos.

Testes locais de contrato e fluxos simulados Gmail/Graph; typecheck TS; AES-GCM, PKCE, sessão, CSRF, conflito de datas, outbox incerto. Benchmark local em `bench/results.json`.

Limites: registry npm indisponível (`EAI_AGAIN`); sem dependências instaladas via rede, `wrangler` não executado; sem contas OAuth institucionais e sem permissão para publicar na nuvem. Automação gráfica com Playwright/Chromium bloqueada por política do ambiente; UI não validada visualmente em navegador. Consulte `KNOWN_LIMITATIONS.md`.

**Próximo passo prioritário:** piloto cloud privado com contas de teste autorizadas e validação real de Cloudflare Workers Free, sem usar caixa postal de terceiros sem consentimento.


## Aurora 1.2 — 12/11/2026

- Código 1.1 copiado preservando original, auditoria de sessões, OAuth e estados de sincronização.
- Migrações 0006–0009; sessões revogáveis, OAuth pending atrelado à sessão, alterações de calendário próprias e contador de chamadas.
- Endpoints e UI de correção/cancelamento manual, retry consciente, cron que alterna contas para diminuir consultas por execução.
- Testes 26 → 37; smoke HTTP local automatizado; backup/restore cifrado testado isoladamente; benchmark SQL com cenário de 2 contas.
- Sem teste de APIs reais nem deploy Cloudflare; não tratar como lançamento de produção.
