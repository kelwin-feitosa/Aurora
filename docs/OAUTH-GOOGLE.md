# Gmail / Google Workspace — OAuth

**Permissões solicitadas pelo código:** `openid email`, `gmail.readonly` (conteúdo e histórico), `calendar.app.created` (criação de calendário próprio e seus eventos) e `calendar.calendarlist.readonly` (localizar calendários). Confirme escopos e políticas na documentação atual da Google; alguns desses escopos são classificados como restritos/sensíveis.

Fluxo: autorização pelo Google → `state` e PKCE → callback HTTPS exato `/api/oauth/callback/gmail` → token no backend → AES-GCM no banco → sincronização `users.messages` e `users.history.list` → calendário separado. Não usa senha do Gmail, cookies da conta ou senha de app.

Configuração: registre um cliente OAuth adequado ao redirect de aplicação web no Google Cloud Console, habilite as APIs Gmail e Calendar, configure sua tela de consentimento e os escopos, defina `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` como variáveis/secret corretos em sua instância.

**Distribuição para público:** a classificação restrita do escopo Gmail pode exigir verificação OAuth e possível avaliação de segurança. O fluxo para um piloto pessoal não é garantia de aprovação ou acesso para qualquer universidade. Sem autorização da organização, o aplicativo deve indicar bloqueio. Não solicite aos estudantes códigos MFA nem contorne políticas.

Links: https://developers.google.com/workspace/gmail/api/auth/scopes · https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification · https://developers.google.com/workspace/calendar/api/auth
