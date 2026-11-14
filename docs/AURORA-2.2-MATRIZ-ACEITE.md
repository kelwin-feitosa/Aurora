# Aurora 2.2 — matriz de aceite (estado verdadeiro)

Estados: **IMPLEMENTADO E TESTADO LOCALMENTE** = testes/contratos/mock/SQLite; **IMPLEMENTADO, SEM PROVA EXTERNA** = código existe, mas precisa fornecedor real; **BLOQUEADO POR TERCEIRO** = autorização/infra não acessível; **NÃO IMPLEMENTADO** = faltante. Nenhum item abaixo equivale a homologação pública.

| ID | Cenário | Estado | Evidência/limite |
|---|---|---|---|
| H01 | Aplicação/PWA | IMPLEMENTADO E TESTADO LOCALMENTE | Manifesto/SW/HTTP, sem navegador real |
| H02 | Instalação por estudante leigo | IMPLEMENTADO, SEM PROVA EXTERNA | Wizard e onboarding; cadastro Cloudflare/OAuth manuais |
| H03 | Gmail institucional real | BLOQUEADO POR TERCEIRO | OAuth Gmail restrito, nenhum token real coletado |
| H04 | Outlook institucional real | BLOQUEADO POR TERCEIRO | Microsoft Entra e admin consent não testados |
| H05 | Evento explícito com data/hora | IMPLEMENTADO E TESTADO LOCALMENTE | Testes 2.0 preservados |
| H06 | Tarefa sem hora | IMPLEMENTADO E TESTADO LOCALMENTE | Dia inteiro, sem inventar horário |
| H07 | Mudança ambígua | IMPLEMENTADO E TESTADO LOCALMENTE | Confirmação antes de alteração |
| H08 | Várias datas por e-mail | IMPLEMENTADO E TESTADO LOCALMENTE | Parcial, máx. 3 decisões; testes 2.0 |
| H09 | Não duplicar na ressincronização | IMPLEMENTADO, SEM PROVA EXTERNA | Idempotência simulada, remoto pendente |
| H10 | Mesmo título em datas distintas | IMPLEMENTADO E TESTADO LOCALMENTE | Fingerprints e evidência origem |
| H11 | Remover evento próprio | IMPLEMENTADO, SEM PROVA EXTERNA | Contratos Google/Graph simulados |
| H12 | POST incerto | IMPLEMENTADO, SEM PROVA EXTERNA | Reconciliador simulado |
| H13 | Falhas cron e checkpoint | IMPLEMENTADO, SEM PROVA EXTERNA | Páginas/leases simulados; sem Worker real |
| H14 | Revogar sessão | IMPLEMENTADO E TESTADO LOCALMENTE | Revogação API + push vinculada |
| H15 | PWA celular/PC real | BLOQUEADO POR TERCEIRO | Dispositivos e browser E2E não validados |
| H16 | Cache sem PII | IMPLEMENTADO, SEM PROVA EXTERNA | Inspeção SW/HTTP, sem E2E real |
| H17 | Desconectar conta e revogar OAuth | IMPLEMENTADO, SEM PROVA EXTERNA | Desconexão local; revogar no provedor ainda manual |
| H18 | Backup e restauração | IMPLEMENTADO, SEM PROVA EXTERNA | Fluxos locais 2.0, D1 Cloud não testado |
| H19 | Atualizações sem perda | IMPLEMENTADO, SEM PROVA EXTERNA | Migração 2.0→2.2 SQLite verificada; rollback remoto não validado |
| H20 | Operação Free dentro de cotas | BLOQUEADO POR TERCEIRO | Benchmark SQL local; CPU e D1 real ausentes |
| H21 | Convites ICS hostis | IMPLEMENTADO E TESTADO LOCALMENTE | Parser conservador da 2.0, sem corpus real |
| H22 | Consentimento institucional bloqueado | IMPLEMENTADO, SEM PROVA EXTERNA | Erros e instruções existentes; experiência real ausente |
| H23 | Sincronização adaptativa | IMPLEMENTADO, SEM PROVA EXTERNA | Testes + simulador; 2×50/dia sem backlog no modelo otimista |
| H24 | Web Push opcional | IMPLEMENTADO, SEM PROVA EXTERNA | ES256, allowlist, 201/410/429, SW; nenhum aparelho recebeu push real |
| H25 | Onboarding verificado | IMPLEMENTADO E TESTADO LOCALMENTE | Não marca calendário testado sem outbox committed |
| H26 | Lockfile/npm audit/SBOM | NÃO IMPLEMENTADO | EAI_AGAIN no npm registry; release NO-GO |
| H27 | Deploy to Cloudflare comprovado | BLOQUEADO POR TERCEIRO | URL/banco D1 placeholders; predeploy bloqueia propositalmente |
| H28 | Usabilidade WCAG/navegador | IMPLEMENTADO, SEM PROVA EXTERNA | Sem Playwright/browser e sem teste com estudantes |

**GO/NO-GO:** release candidate local **GO** para laboratório autorizado; **NO-GO** para lançamento institucional ou distribuição pública. Consultar `AURORA-2.2-HOMOLOGACAO.md`.
