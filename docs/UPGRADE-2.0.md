# Atualizar Aurora 1.6 → 2.0 RC

1. Exporte os dados do usuário e faça backup cifrado completo (local ou D1) antes de atualizar. Nunca inclua `APP_SECRET`, tokens ou backup no repositório.
2. Pare o cron/servidor durante a migração e guarde uma cópia restaurável da versão 1.6, com instrução de rollback. Faça primeiro uma restauração de ensaio.
3. Atualize o código mantendo `APP_SECRET`, `PUBLIC_ORIGIN`, dados e autorizações existentes.
4. Configure `AUTO_APPROVE_MODE=review` (padrão seguro). Opcionalmente `trusted-senders` + `TRUSTED_SENDER_ADDRESSES` exatos, após avaliar risco de falsificação do From. Nunca permita automação por padrão para todos os remetentes.
5. Execute migrações `0011_pending_automation_safety.sql` e `0012_sync_failure_backoff.sql` com ferramenta oficial; verifique `npm run schema:status` no local e as migrations em D1 de ensaio. **Não** editar tabelas remotas manualmente.
6. A `0011` move para revisão itens que foram aprovados automaticamente mas ainda não enviados (outbox `planned`/`retryable`). Confirme esses itens novamente antes de criar eventos. `unknown`/`in_flight` permanecem em reconciliação segura.
7. A `0012` adiciona `next_sync_at` para backoff por conta. O novo Worker deve ser publicado **após** aplicar a migração de esquema; versão antiga pode continuar sem ler a coluna, mas o novo código precisa da coluna.
8. Execute `npm run verify` e `npm run release:gate`; obtenha lockfile legítimo com acesso ao registry. Antes de ativar cron, compare contas, backlog e eventos originais; não aceite duplicações.
9. Nunca restaure SQL diretamente no banco produtivo sem quarentena. Use o fluxo de D1 em banco **novo e vazio** da versão 1.6 e reveja a reconciliação antes de reativar conexões.

Rollback requer revisão de mudanças de esquema; não há rollback automático remoto validado. Restaurar uma versão antiga com banco migrado deve ser testado em cópia, nunca presumido seguro.
