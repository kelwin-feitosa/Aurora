# Architecture Decision Records — 0.1.0

**ADR-001 Runtime leve:** monólito modular TypeScript, Worker serverless + D1 preferencial, Node/SQLite local secundário. Motivo: evitar framework e chamadas pagas em operação individual. Estado: provisório até benchmark Cloudflare real.

**ADR-002 Integrações oficiais:** Gmail e Graph via REST mínimo próprio, sem SDK pesado; OAuth delegado com PKCE. Motivo: bundle pequeno, contratos explícitos, baixa dependência. Estado: implementado offline; autorização real pendente.

**ADR-003 Dados mínimos:** IDs e fatos derivados, nunca corpo completo persistido. Tokens cifrados WebCrypto AES-GCM com AAD contextual. Estado: testado localmente.

**ADR-004 Falha fechada:** incerteza de data, repetição ou resultado de POST gera revisão/bloqueio; sem ações externas por conteúdo de e-mail. Estado: testado com mocks.

**ADR-005 Calendário próprio e lembretes nativos:** evitar push própria e alterações em calendário alheio. Estado: implementado, prova real pendente.

**ADR-006 Instalador:** HTML guiado + Deploy to Cloudflare, sem sacrificar segurança ou fingir automação de consentimento. Estado: parcial até repo público e teste com usuário leigo.
