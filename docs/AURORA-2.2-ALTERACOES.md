# Diferenças técnicas da 2.0 para a 2.2

- `wrangler.jsonc`: `*/15` → `*/3` (frequência de disparos, não de polling obrigatório).
- `src/app/pipeline.ts`: colunas de tentativa/sucesso e retomada acelerada quando provedor sinaliza `nextPage`, conservando cursor atômico.
- `migrations/0013_*`, `0014_*`, `0015_*`: saúde, push por aparelho e estado de onboarding.
- `src/app/push.ts`: módulo novo; VAPID ES256 WebCrypto, endpoint cifrado, allowlist e dispatched opt-in sem payload; não copia código de terceiros.
- `src/index.ts`: despacho push em ciclo independente quando habilitado, sem prejudicar sync se não houver alerta.
- `src/web/handler.ts`: APIs autenticadas de push/onboarding, métricas de fila e revogação por sessão.
- `src/web/sw.js`: handlers `push` e `notificationclick` com aviso neutro. Cache de API privado permanece proibido.
- `src/web/ui.html`, `client.js`, `ui.ts`: preferências de notificações e wizard verificável com 2.2; `scripts/build-ui.mjs` regenera export de UI.
- `scripts/create-vapid-keys.mjs`, `.gitignore`, `.dev.vars.example`: setup offline sem expor segredos; nunca enviar para GitHub.
- `bench/bench-schedule-2.2.py`: cenários determinísticos 30 dias, p50/p95/p99 e comparativo com a 2.0.
- `tests/aurora22.test.mjs`: nova cobertura de segurança, migração e fluxo; testes originais intactos.
- `package.json`, `scripts/pwa-audit.mjs`, `README.md`, docs: metadados 2.2.

**Preservação:** distribuição inclui ZIP original da Aurora 2.0 e código atualizado em pasta distinta. Migrações são aditivas, com teste de atualização local. Não há commits/PRs remotos: mudanças aplicadas somente na cópia local.
