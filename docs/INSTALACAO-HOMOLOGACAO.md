# Aurora 2.4 — instalação, atualização controlada e homologação

**A candidata é interna, sem publicação.** O ZIP verificado de código-fonte está como artifact privado do CI da branch feature/aurora-2.3; não contém dados reais de usuários, tokens, backups nem provisionamento da Cloudflare. Consulte RELEASE-CHECKLIST.md.

## Preparar ambiente de desenvolvimento

1. Obter código ou ZIP interno autorizado e conferir SHA-256 com SHA256SUMS.txt incluído no artifact; não é o hash do ZIP wrapper do GitHub.
2. Instalar Node.js >=22.10, npm compatível. Executar npm ci --no-audit --no-fund, npm audit --audit-level=high, npm run build, npm run lint, npm run typecheck, npm test e npm run verify.
3. Executar npm run doctor e npm run setup para configurar uma instância de desenvolvimento. Nunca versionar .dev.vars, .env ou backups.
4. Usar exclusivamente dados simulados sem OAuth institucional para teste offline. Para migrações locais, npm run migrate:local e revisar status/schema.
5. Comparar npm run bench:monitoring24, bench:d1 e bench:multi com corpus fixo; a pasta artifacts é saída sintética local.
6. Conservar AUTO_APPROVE_MODE=review. Não ativar trusted-senders enquanto não houver prova confiável da origem do e-mail, pois From não autentica remetente.

## Atualizar uma instância existente (SOMENTE após autorização futura)

1. Congelar versão e registrar hash de HEAD, lista de migrations aplicadas, histórico de eventos e cotas.
2. Fazer backup D1 autorizado e ensaiar restauração em **novo banco isolado**. Conferir contagens, FKs, tokens cifrados, filas pendentes e eventos remotos. Nunca substituir a base viva sem teste/consentimento.
3. Aplicar migrations pendentes no banco de ensaio, inclusive 0017 (coluna force_full_read default 0). Verificar que mensagens antigas continuam normais e bloqueios explícitos não foram reencaminhados.
4. Rodar suite e fluxo Gmail/Outlook consentido em ambiente de testes separado, com tokens de teste de menor privilégio. Confirmar política da instituição/administrador.
5. Medir CPU p95/p99 real Workers, linhas D1 reais, quotas por provedor, consentimento, atraso de entrega de tarefas e comportamento de filas/backoff.
6. Só então solicitar autorização separada para deploy, com rollback ensaiado. A Missão 2.4 não autorizou deploy e nenhum foi realizado.

## Roteiro de homologação de usuário

- Gmail: consentimento, bootstrap, history expired, conta sem mensagens, mensagens com datas, falsificação de From/assunto genérico e opt-out sensível, revogação.
- Outlook: tenant autorizado, deltaLink/nextLink, evento Graph propriedade comprovada, calendário, throttling 429, token antigo sem campos novos.
- Dispositivos: PWA Android Chrome, iOS Safari, navegador desktop, modo offline, service worker, restart, atualização, push opt-in/opt-out e quiet hours; nunca supor que 201 de gateway = push entregue.
- Backup/restore: corromper backup sintético e comprovar rejeição; restaurar de forma isolada e validar contagens. Não fazer destrutivos em dados vivos.
- UX/acessibilidade: navegação sem mouse, leitor de tela, contraste WCAG, feedback de bloqueios, estados incompletos, erros OAuth legíveis, ciência de dados pessoais armazenados.
- Segurança: Origin/CSRF, sessões, SSRF, injeção indireta, MIME/ICS, rate limits, vazamento de tokens, headers de cache e logs.
- Custos: monitorar planilhas oficiais e alertas de quota sem aceitar upgrades automáticos ou mudar cobrança.

## Sinais de bloqueio

Qualquer falha em integridade, autenticação de remetente, migrar banco, recuperar outbox unknown, limite real de CPU/D1, ou autorizações institucionais é **NO-GO**, não justificativa para forçar produção. Sem autorização explícita, parar na candidata de laboratório.
