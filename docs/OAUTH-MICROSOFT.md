# Outlook / Microsoft 365 — OAuth

**Escopos delegados pretendidos:** `openid profile email offline_access User.Read Mail.Read Calendars.ReadWrite`. Sem permissões Application de leitura ampla de caixas. O OAuth usa state de uso único e PKCE. A API `/me/mailFolders/inbox/messages/delta` permite sincronização incremental por pasta e preserva links opacos. O app grava compromissos somente no calendário dedicado à conexão.

Registrar um aplicativo no Microsoft Entra, autorizar a plataforma Web e o callback HTTPS `/api/oauth/callback/outlook`, configurar `MICROSOFT_CLIENT_ID`, o tenant (`organizations` por padrão) e, se exigido pelo tipo de app, `MICROSOFT_CLIENT_SECRET`.

**Instituições podem bloquear consentimento individual.** Nesse caso, pedir autorização oficialmente ao administrador. Não usar compartilhamento de senha, tokens de terceiros, scraping de sessões ou alterações de permissão indevidas. O teste com uma conta Microsoft pessoal não prova compatibilidade com UDF/CEUB.

Links: https://learn.microsoft.com/en-us/graph/delta-query-messages · https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-app-consent-policies · https://learn.microsoft.com/en-us/graph/api/user-post-events
