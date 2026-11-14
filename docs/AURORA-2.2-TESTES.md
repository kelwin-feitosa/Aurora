# Verificação e experimentos reproduzidos — 2.2

Ambiente de execução: Linux, Node.js **22.16.0**, npm **10.9.2**, TypeScript global instalado, SQLite de `node:sqlite`. Verificações realizadas no ambiente de desenvolvimento sem credenciais institucionais.

```sh
npm test
npm run verify
npm run bench:d1
npm run bench:multi
python3 bench/bench-schedule-2.2.py
npm run audit:pwa
npm run security:check
npm run doctor
```

**Linha de base recuperada:** 81/81 testes verdes da Aurora 2.0. **Resultado da Aurora 2.2:** 98/98 testes verdes. O pipeline de `npm run verify` completa build, lint, typecheck, testes, smoke HTTP, benchmarks locais, auditoria estática PWA, verificação de higiene de secrets e doctor. Inclui testes para VAPID JWT ES256 verificável, validação/SSRF de endpoint, consentimento, cifra de endpoint, revogação após logout, persistência do opt-in após expiração natural de cookie, silêncio à meia-noite/fuso, 201/410/429, nenhuma notificação sem opt-in, não revelar endpoint por API, agendamento 3/15min, onboarding que não se declara concluído e atualização de banco 2.0→2.2.

**Tentativa documentada e não aprovada:** `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=7000`: `EAI_AGAIN registry.npmjs.org`. Não foi criado lockfile artificial; `npm ci`, `npm audit` e cadeia de fornecedores estão pendentes.

**Classificação:** contratos Gmail/Graph e push usam simuladores HTTP; não houve rede real para instituições, gateways Apple/Google/Mozilla ou deploy real. Typecheck não equivale a SAST completo. A simulação de filas não equivale a latência do serviço real.
