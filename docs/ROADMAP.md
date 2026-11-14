# Aurora 1.6 — Gates para homologação, não nova missão de construção

**Concluído localmente:** 1.5 RC preservado; classificação multi-itens em revisão; ICS seguro e limitado; adaptadores Gmail/Graph atualizados e testados por mocks; fila/journal de ações seguros; exportação JSON paginada; revogação de sessões pela UI; criptografia e backup D1 simulado; migração de privacidade; orçamento sintético D1; PWA e wizard mantidos.

## Gate externo P0 (não executável sem contas, dispositivos ou rede apropriados)

1. Gerar/validar lockfile com registry online, `npm ci` desde checkout limpo, `npm audit` e CI oficial; analisar CVEs.
2. Deploy Cloudflare Free numa conta de teste autorizada, aplicar 10 migrations, medir CPU real p50/p95/p99, consultas, linhas D1, subrequests, retries/backlog e orçamento mensal, inclusive piores casos.
3. Autorizar OAuth Google e Microsoft em contas de teste consentidas conforme instituições; validar revogação, reconexão, erro de autorização e uso de calendário dedicado com provas sintéticas.
4. Ensaiar backup/restauração D1 remoto em banco novo e vazio de teste, com comparação SQL, cutover manual, APP_SECRET e reconciliação sem reexecutar mutações.
5. Testar instalação PWA em dispositivos reais (Android/iPhone/desktop), offline seguro, atualização do SW, acessibilidade e compatibilidade; definir política de notificações.
6. Auditoria independente de segurança, privacidade, escopos OAuth e avaliação das políticas aplicáveis à distribuição pública.

## Decisões para evolução posterior (não bloqueiam núcleo conservador)

- Aumentar precisão com corpus real anonimizado, sem obrigar IA paga; avaliar precisão de eventos automáticos antes de ampliar autonomia.
- Suportar fusos adicionais, pastas Outlook personalizadas, convites recorrentes/PDFs e fluxo explícito de notificações Web Push.
- Simplificar instalação pública e atualização com um repositório distribuído, registros OAuth aprovados e provisionamento legítimo; nunca fingir um clique sem permissão.

**Não declarar produção homologada até todos os testes externos requeridos passarem.**
