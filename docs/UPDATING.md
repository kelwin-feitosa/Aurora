# Atualizar e recuperar instâncias Aurora — procedimento conservador 1.6

**Não existe instalador universal de atualização por um clique nem rollback automático remoto validado.** Cada usuário controla a própria instância. O frontend PWA pode atualizar via service worker, mas isso NÃO atualiza o Worker, as migrações, nem credenciais OAuth.

1. Confira a versão atual, o `CHANGELOG.md`, o alvo do banco e as permissões. Suspenda sincronizações durante manutenção, se possível.
2. Faça e **verifique** backup cifrado do banco (local ou via Wrangler), registre o segredo de instalação `APP_SECRET` num cofre privado separado e garanta espaço/retenção. Não inclua esses arquivos no Git.
3. Obtenha a versão de fonte oficial, valide checksum/assinatura disponível. Inspecione alterações de migrations (`0001` a `0010`) antes de aplicar. `0010` exclui permanentemente `source_excerpt` histórico por privacidade.
4. Execute `npm run verify` local, prepare atualização em ambiente isolado, aplique migrations no alvo de teste e faça smoke de login, sessões, export, calendário e Gmail/Outlook sintéticos.
5. Num deploy Cloudflare autorizado, instale dependências do registry confiável (gerar lockfile e rodar `npm ci` antes do primeiro release público), ajuste env/secrets e publique o Worker; confira logs/cron e custos no dashboard.
6. Se falhar, suspenda escrita e recupere a implantação anterior. **Reverter binário não reverte migrations:** para falha de dados, planeje restauração validada para banco D1 NOVO em quarentena, reconcilie eventos antes de qualquer retomada.

Nunca habilite ações antigas após restauração sem verificar no calendário remoto quais já foram aplicadas. Consulte `BACKUP-RESTORE.md`. Para atualização sem terminal, o assistente existente ainda é orientativo e depende de UX validada com usuários reais.
