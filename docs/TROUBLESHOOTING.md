# Solução de problemas

| Sintoma | Possível causa e ação |
|---|---|
| `INSTALLATION_SECRETS_NOT_CONFIGURED` | Configure APP_SECRET (32 bytes base64url), senha >=20 caracteres e PUBLIC_ORIGIN correto; não coloque secrets no Git. |
| Login recusado / `TOO_MANY_ATTEMPTS` | Confirme senha da sua instância e aguarde 15 min após cinco erros; não é a senha do e-mail. |
| Botão Gmail/Outlook desabilitado | Client ID e, quando necessário, client secret não foram configurados. |
| Redirect mismatch | Compare `PUBLIC_ORIGIN` e redirect URI registrados no Google/Microsoft (incluindo HTTPS e caminho exatos). |
| `consent_required` / admin | A instituição pode bloquear acesso; peça autorização oficial. |
| `RECONNECT_REQUIRED` | OAuth revogado, expirado ou sem permissão; desconectar e reconectar oficialmente. |
| Mensagens não apareceram | Veja a última sincronização, erro, limites diários e se a API está acessível. O backfill inicial cobre uma janela limitada. |
| Evento duplicado | Verifique outra mensagem para mesma data/assunto ou confirmação manual. Não exclua evento alheio sem revisar. |
| `REMOTE_RESULT_AMBIGUOUS_REVIEW_REQUIRED` | Confira o calendário remotamente ANTES de usar o botão de nova tentativa. |
| Cron não executa | Confira Cloudflare triggers no painel e permissões/cotas da conta. |
| `APP_SECRET` perdido | Tokens cifrados podem ficar irrecuperáveis; reconecte os provedores oficialmente. |
| Atualização quebrou o banco | Pare o serviço; não recrie banco; restaure backup seguro e revise migrações. |

Não compartilhe screenshots com tokens, informações de e-mail, CPF ou cookies.
