# Aurora 2.4 — Threat model STRIDE e controles

Data: 2026-11-14. Modelo baseado em leitura estática e testes offline. Referência: OWASP ASVS 5.0.0 (https://asvs.owasp.org/) e OWASP Prompt Injection (https://genai.owasp.org/glossary/prompt-injection/). Sem alegação de conformidade/certificação ASVS.

## Ativos e fronteiras de confiança

Ativos: credenciais de conexão e refresh tokens cifrados, APP_SECRET, cookies, consentimentos, metadados de e-mails, mensagens, decisões, eventos remotos, endpoints Push, preferências e backups.
Fronteiras: navegador não confiável → Worker autenticado; Worker → D1; Worker → Google/Graph; conteúdo externo de e-mail/ICS → parser; Worker → gateway Web Push; operador → instalação/backup.
Eventos de e-mail nunca constituem instrução privilegiada nem autenticação de remetente.

| STRIDE | Cenário adversarial | Controle observado | Lacuna / prioridade |
|---|---|---|---|
| S Spoofing | Um atacante falsifica From de professor em mensagem com data explícita | Revisão humana padrão, allowlist exata | **P1:** opt-in trusted-senders confia em From não verificado. NO-GO enquanto habilitado; exigir confirmação manual ou verificação confiável de autenticidade |
| S Spoofing | OAuth callback reaproveitado em sessão diferente | state com consumo único, PKCE, vinculação à sessão e tempo limite | Homologar OAuth institucional e consentimento de tenant |
| T Tampering | Injeção em mensagens ICS, datas conflitantes, URLs controladas | parser limitado, classificação para review, APIs de provedores com destinos permitidos | Não cobrir recorrências/zonas arbitrárias sem corpus |
| T Tampering | Manipular resultado de gravação remota | outbox, IDs estáveis, verificação de propriedade, status unknown e bloqueio conservador | Testar reconciliação real após timeout |
| R Repudiation | Revisão/aceite sem rastro | logs de código, filas, estados duráveis e auditoria de ações sem corpo do e-mail | Confirmar janela de retenção e logs mínimos LGPD |
| I Disclosure | Sessão alheia enumera Push de outro dispositivo | Filtragem por session_hash para status/revogação | Uma instalação usa um administrador; isolamento por usuário distinto não foi provado |
| I Disclosure | Cache de e-mail, tokens ou PII em PWA | SW guarda apenas arquivos estáticos públicos; API autenticada não é cacheada | Auditar navegadores reais e notificações lock-screen |
| D DoS | Spam/OAuth e sincronização excedem limite | rate limit, timeout 12 s, limite por ciclo/dia, retries limitados | CPU Free=10 ms, D1 linhas não monitoradas no runtime real |
| D DoS | Mensagem maior que limite força consumo | resposta JSON 512KiB, corpo/travessia MIME limitados; 2 mensagens/ciclo | Falhas repetidas e filas precisam telemetria |
| E Elevation | Página falsa causa CSRF ou SSRF | Origin estrita, cookies protegidos, allowlist HTTPS sem redirecionamento | Testar browsers e integrações novas |
| E Elevation | Texto de e-mail tenta dar ordens ao assistente | Parser de regras sem execução de instruções externas; confirmação de ações incertas | Não incluir IA agente autônoma sem controle formal |

## Segurança operacional mínima

1. Usar AUTO_APPROVE_MODE=review; tratar a opção trusted-senders como **risco alto não resolvido**, não como assinatura verificada.
2. Armazenar APP_SECRET e clientes OAuth somente nos secrets autorizados do ambiente, nunca no GitHub, exportação ou ZIP.
3. Usar OAuth por instalação com escopo mínimo, conferir autorização da instituição e informar claramente o que é lido e persistido.
4. Aplicar migrações D1 após backup verificado e ensaio de restauração isolada; não retirar transações de idempotência.
5. Não enviar assunto, nome, prazo ou trecho de mensagem ao gateway Push; aceitação HTTP do gateway não prova entrega.
6. Renovar/revogar sessões e conexões e medir incidentes sem copiar conteúdo de estudantes em logs.
7. Manter testes de limites de respostas, URLs, seleção de host, conflito temporal, retries e origem remota antes de evoluir automações.

## Não-go e risco aceito

A configuração de autoaprovação por From não verificado é um bloqueador para homologação pública, embora o modo padrão seja revisão humana. Pentest, DPIA/LGPD, verificação institucional e dispositivos reais permanecem externos. Não existe alegação de segurança absoluta.
