# Aurora 2.0 — Matriz de aceite H01–H22

`LOCAL` = coberto em testes locais/simulados; `EXTERNO` = exige prova indisponível; `PARCIAL` = implementado com limitações de produto. **Não interpretar `LOCAL` como produção homologada.** Consulte `HOMOLOGATION-2.0.md` para a decisão GO/NO-GO.

| ID | Critério | Estado 2.0 | Evidência/pendência |
|---|---|---|---|
| H01 | Explicar backend/PWA | LOCAL | UI, manifesto, auditoria PWA |
| H02 | Instalação por usuário leigo | PARCIAL/EXTERNO | Wizard local; Cloudflare/OAuth exige consoles oficiais |
| H03 | Gmail OAuth/sincronização real | EXTERNO | Contratos e mocks, sem conta CEUB autorizada |
| H04 | Outlook OAuth/sincronização real | EXTERNO | Contratos e mocks, sem conta UDF autorizada |
| H05 | Evento explícito com horário | LOCAL | Classificador; horários contraditórios agora exigem revisão |
| H06 | Tarefa só com data | LOCAL | Não inventar horário |
| H07 | Mudança ambígua | LOCAL | Exige revisão humana |
| H08 | Dois prazos no e-mail | LOCAL | Fluxo 1.6 preservado em regressão |
| H09 | Não duplicar na ressincronização | LOCAL/EXTERNO | Inbox/outbox + testes; comportamento remoto pendente |
| H10 | Mesmo título em dias diferentes | LOCAL | Identidade da fonte/tempo preservada |
| H11 | Remover evento próprio | LOCAL/EXTERNO | Google propriedade reforçada; contas reais não testadas |
| H12 | POST incerto e reconciliação | LOCAL/EXTERNO | Graph página extra não equivale a ausência; prova real pendente |
| H13 | Falha cron e checkpoint | LOCAL/EXTERNO | Backoff e isolamento por conta; cron remoto pendente |
| H14 | Revogar sessão | LOCAL | Testes HTTP e unitários |
| H15 | Instalar PWA em dispositivo | EXTERNO | Manifesto e SW validados; aparelhos reais não testados |
| H16 | Cache offline não expõe dados | LOCAL/EXTERNO | SW examinado; browser real pendente |
| H17 | Desconectar conta | LOCAL/EXTERNO | Interface e mocks; revogação real depende do provedor |
| H18 | Exportar e restaurar dados seguros | LOCAL/EXTERNO | Criptografia e cenários locais; D1 remoto pendente |
| H19 | Atualizar/migrar/rollback | PARCIAL/EXTERNO | Migrations 0011/0012 testadas localmente; rollback remoto não validado |
| H20 | Cota Free e limite de consumo | LOCAL/EXTERNO | SQL 44→37, D1 remoto/CPU/quota de linhas pendentes |
| H21 | ICS suspeito ou recorrente | LOCAL | Parser restritivo e revisão; corpus real pendente |
| H22 | Bloqueio institucional visível | PARCIAL/EXTERNO | Docs e erro estruturado, experiência real pendente |

## P0 adicionais de segurança/cadeia de fornecimento

- **NO-GO** se Gmail/Outlook de produção não tiverem autorização ou se D1 Free exceder cotas nos cenários-alvo.
- **NO-GO** até versionar lockfile legítimo, realizar `npm ci` e `npm audit`, rodar CI e SAST apropriado.
- **NO-GO** para aprovação automática ampla: autenticação da origem de e-mails requer prova adicional. Revisão humana é o padrão seguro.
- **NO-GO** até demonstrar restauração, instalação PWA, acessibilidade e observabilidade em ambiente real.
