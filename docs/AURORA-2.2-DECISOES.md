# ADRs, trade-offs e rollback

**ADR-22-01 manter Cloudflare Free (provisoriamente).** A base existente usa Workers+D1 e a pesquisa 2.1 não demonstrou alternativa comprovadamente melhor. Testar em conta real antes de compromisso público. Rollback: manter original 2.0; não migração não testada.

**ADR-22-02 cron 3 minutos + pausa 15 minutos quando ocioso.** Motivação: mensagens atrasavam sob 2 contas. Evidência: simulação em bench e teste de `next_sync_at`. Risco: 63% mais chamadas no cenário 2×50/dia no modelo; sem margem certificada de CPU Workers. Rollback: restaurar `*/15` e defaults, mantendo schema compatível.

**ADR-22-03 Web Push opcional sem payload.** Motivação: alertar revisão sem revelar dados de e-mails na lockscreen e sem inventar AES128GCM RFC8291. Usa WebCrypto ES256 para VAPID, allowlist de push serviços; calendar continua principal. Risco: não entrega confiável e sem teste de gateway real. Padrão `PUSH_ENABLED=0` e opt-in por dispositivo. Rollback: desativar env flag; inscrições cifradas podem ser excluídas após consentimento.

**ADR-22-04 consentimento independente do cookie.** Expirar sessão em 8h não deve quebrar o envio para telefone fechado; logout e revogação de sessão cancelam inscrições associadas, dono autenticado pode revogar outros dispositivos. Risco: assinatura persistente se usuário nunca desativar e perder acesso; exigir UI de gerenciamento e documentação de revogação.

**ADR-22-05 onboarding baseado em probes.** Progresso real não pode ser marcado por clique; única preferência persistida é pular push opcional. Calendar só considerado testado após `outbox.state='committed'` com `calendar_id` preenchido.

**ADR-22-06 segurança/cadeia de fornecimento:** não criar package-lock artificial nem publicar publicamente sem validação externa e SCA. Não introduzir novo framework ou biblioteca de runtime desnecessária.
