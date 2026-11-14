# Cloudflare Workers + D1 — implantação técnica

**Ainda não executado com conta Cloudflare real.** Testar primeiro em uma conta de desenvolvimento própria, antes de confiar em avisos acadêmicos importantes.

## Preparar

1. Entre em sua conta Cloudflare Free. A partir do repositório público use o recurso [Deploy to Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/). A plataforma pode provisionar D1 com base em `wrangler.jsonc`.
2. Verifique no dashboard o Worker, o banco D1, o cron `*/15 * * * *`, e os bindings `DB`/`PUBLIC_ORIGIN`. O UUID `00000000-...` do template é **placeholder**, não banco real. Substitua pelo ID provisionado caso necessário.
3. Configure como **secrets**, não como vars públicas: `APP_SECRET`, `INSTALLATION_PASSPHRASE`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_SECRET` (se exigido). IDs de cliente públicos são separados por provedor. `PUBLIC_ORIGIN` precisa ser HTTPS e corresponder ao Worker efetivo.
4. Aplique todas as migrations **0001 a 0010** na ordem, verificando o alvo remoto, com backup antes; a `0010` limpa excertos históricos em claro. Com Wrangler disponível e login autorizado: `npm run migrate:remote`; para local `npm run migrate:local`.
5. Realize `npm run build` antes do deploy e `npm run deploy` se estiver usando CLI oficial. Revalide a operação contra as versões atuais do Wrangler.
6. Registre os callbacks HTTPS exatos: `/api/oauth/callback/gmail` e `/api/oauth/callback/outlook`, nas consoles oficiais.
7. Execute uma sincronização com e-mails sintéticos autorizados, monitore as métricas Workers e revise o calendário.

## Cuidados

- **Não** execute migrações destrutivas no banco ativo sem backup. `wrangler d1 migrations` gerencia migrations remotas; não substitua o banco ao fazer deploy.
- Não ative plano pago nem binding de Workers AI por engano. O produto funciona sem IA.
- O limite de CPU Workers Free é 10 ms por execução, 50 subrequisições/execução e 100.000 requisições/dia em documentação consultada em 12/11/2026; **não há benchmark real desta versão no Workers Free**.
- Para autorizações de aplicativos Google, escopos de Gmail são restritos e podem exigir verificação/auditoria; instância própria não dispensa políticas. Para Microsoft, a instituição pode exigir administrador.

## Fail closed

Se faltar segredo, `PUBLIC_ORIGIN`, migração D1 ou conta autorizada, o Aurora não deve afirmar que está pronto. Verifique `/api/session` e `/api/data` após login. Nenhum dado pessoal deve ser visível sem sessão. [Limitações](KNOWN_LIMITATIONS.md).


**Versão 1.6:** backup D1 localmente cifrado e restauração para banco novo em quarentena estão disponíveis em `docs/BACKUP-RESTORE.md`, mas a operação com Cloudflare real não foi testada.
