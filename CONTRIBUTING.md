# Como contribuir

1. Abra uma issue não sensível descrevendo o problema e critérios verificáveis.
2. Crie uma branch pequena; preserve Gmail, Outlook, PWA, migrações e políticas de privacidade.
3. Inclua testes unitários/contratos para casos novos; execute `npm run verify` e anote gates bloqueados por infraestrutura.
4. Nunca inclua `.dev.vars`, `.env`, bancos pessoais, backups, dados reais de e-mails, VAPID privada ou tokens no commit/PR.
5. Abra PR com alteração, riscos, testes e rollback. Alterações de OAuth, criptografia, calendários e Web Push exigem revisão extra.

Este projeto utiliza MIT para código próprio; componentes de terceiros seguem suas licenças originais. Não copie código proprietário ou de licenciamento incompatível.
