# Aurora 2.0 — Critérios finais de homologação (GO/NO-GO)

## Implementado e testado localmente

- Núcleo PWA + backend e interfaces Gmail/Outlook simuladas; ver `npm test`, `npm run smoke:http` e `npm run audit:pwa`.
- OAuth com PKCE e estados locais; criptografia autenticada, sessões revogáveis, outbox, idempotência, revisão, migrações e backup D1 simulado.
- Correções 2.0: propriedade remota, bloqueio de busca incompleta, limites de JSON, revisão por padrão, backoff, tempo contraditório, truncamento MIME, quotas de tentativa.
- Benchmarks Node.js/SQLite com roteiro reproduzível; fronteiras de casos adversariais via `tests/audit-2.0.test.mjs`.

## NÃO HOMOLOGADO — bloqueios externos obrigatórios

1. **OAuth Google Gmail/CEUB e Microsoft Outlook/UDF:** consentimento de contas reais, permissões institucionais, tokens e refresh efetivo, reautorização, cursores inválidos, múltiplas pastas quando exigidas, calendários e notificações.
2. **Cloudflare Free:** D1 provisionado, migrations remotas, CPU 10ms e subrequests/queries 50, rows read/write/dia, limites e falhas reais, cron ao longo de vários dias, backup/restauração em banco de ensaio.
3. **Mobile e desktop:** instalar PWA e verificar offline/online/cookies no iOS Safari, Android Chrome, desktop Chrome/Edge/Firefox; teclado e leitores de tela.
4. **Supply-chain:** obter package-lock real no registry oficial, executar `npm ci`, `npm audit`, CI verde, licenças transientes e SAST independente.
5. **Operação:** política LGPD, retenção e exportação com usuário piloto consentido, documentação real com capturas e suporte a erros.
6. **Segurança extra para criação automática:** campo `From` não garante autenticidade. Manter revisão default até validar origem e ameaças com provedores reais.

## Matriz de decisões por prioridade

- **NO-GO produção** se houver criação automática indevida em piloto, perda de deadline conhecido, segredo em frontend/log, duplicação após falha, D1 Free estourado, ausência de migração/rollback ou OAuth não autorizado.
- **GO piloto limitado** somente quando os dois provedores forem testados em ambiente autorizado, alertas e cota forem observáveis, PWA funcionar em pelo menos um celular e um desktop e o usuário souber revisar correções.
- **GO público** apenas após verificação OAuth/distribuição conforme políticas dos provedores, aprovação institucional quando necessária e avaliação de proteção de dados apropriada.

**Status nesta entrega:** RC técnica com testes locais, **NO-GO produção e divulgação pública como plenamente gratuita/segura**.
