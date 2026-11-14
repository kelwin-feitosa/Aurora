# Aurora 2.2.0-rc.1 — relatório consolidado

**Natureza da entrega:** evolução executável da 2.0, NÃO homologada em nuvem nem nas instituições. A fonte anterior foi preservada em arquivo ZIP de referência. O aplicativo é uma PWA, não APK ou EXE.

## Modificações confirmadas

1. **M1 / filas:** cron declarado em `wrangler.jsonc` passa de 15 para 3 minutos; `syncConnection()` registra `last_attempt_at` e `last_success_at`, agendando a próxima checagem após **3 minutos quando há página remota pendente** e aproximadamente **15 minutos quando não há**. O limite seguro padrão continua **1 mensagem por conta por operação**; não aumentamos o lote além do orçamento medido de SQL. Quando duas contas estão elegíveis, permanece seleção justa pela última sincronização. Alteração reversível: restaurar cron de 15 min e `next_sync_at` no checkpoint. Há índices novos em `0013_sync_health.sql`.
2. **M2 / proteção Web Push:** endpoints são validados contra allowlist de serviços push, exigem HTTPS, sem portas personalizadas ou URL com credenciais, são cifrados com AES-GCM associado ao identificador da assinatura, nunca retornados em APIs. Notificações não carregam e-mail, título, instituição ou matéria. Padrão desligado até opt-in e configuração local de VAPID. Sessão expirada naturalmente não desativa notificações, mas revogação explícita/logout as desativa. Migração `0014_push_subscriptions.sql`.
3. **M3 / configuração:** novo endpoint `/api/onboarding` informa etapas verificadas via dados reais, não via cliques. Sem calendário com ação confirmada não registra `CALENDAR_TESTED`. Opção consciente de ignorar notificações persistida em `0015_onboarding_progress.sql`. Diagnóstico inclui fila pendente e idade aproximada do item mais antigo. **Não automatiza o OAuth da universidade ou a criação dos secrets em Cloudflare.**
4. **M4 / notificações opcionais:** chaves VAPID criadas offline por `npm run push:keys`, APIs autenticadas para inscrição, preferências e revogação, `push`/`notificationclick` no service worker. A entrega Web Push é um POST sem payload (não requer implementar criptografia de payload RFC 8291), autenticado por JWT ES256 VAPID, limitado a um dispositivo por disparo de 15 minutos. Status `gateway_accepted` não significa entregue ou visualizado. 410/404 revogam inscrição; 429/5xx entram em backoff; horários de silêncio respeitados.
5. **M5 / interface:** botão de autorização explícita, desativação, horário de silêncio em fuso IANA, diagnóstico e passos de onboarding. CSS e HTML originais preservados; sem framework extra.
6. **M6 / pacote:** todas as migrações aplicadas em teste Node SQLite local, inclusive upgrade de dados 2.0; scripts e código integram no ZIP; verificação em cópia extraída. Sem novo fornecedor de nuvem, API paga ou biblioteca de runtime.

## O que NÃO foi concluído por falta de acesso ou por limite técnico

- OAuth com conta CEUB/UDF, verificação de consentimento institucional, desempenho e CPU real do Worker, D1 remoto, deploy em Cloudflare, notificações Web Push em telefone, PWA E2E com browser real, avaliação de usabilidade de pessoas leigas, SCA/SBOM/npm audit/npm ci (registry indisponível no ambiente). **Proibido chamar isso de homologação.**
- O fluxo `Deploy to Cloudflare` pode provisionar recursos, mas a instalação pública depende de repositório publicado e configuração/consentimento OAuth; este projeto ainda não possui um botão divulgado com URL real. A criação das migrações D1 também precisa ser realizada ou validada no ambiente remoto.
- O modelo adaptativo não elimina filas sob carga muito alta. Os cenários sintéticos de 2 contas × 100/dia ainda apresentam atraso e o caso 2 × 200/dia é incompatível com a capacidade modelada. Nenhum custo monetário foi confirmado em conta de produção.
- A notificação por calendário permanece canal de prazos. O push serve para avisos genéricos de revisão, não garantia temporal nem alternativa à verificação periódica dos e-mails.

**Decisão de lançamento:** NO-GO público e institucional. Há entrega técnica candidata ao piloto, condicionada aos gates em `AURORA-2.2-HOMOLOGACAO.md`.
