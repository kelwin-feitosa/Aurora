# Matriz de aceite Aurora 2.4 — H01 a H28

Revisão 2026-11-14. Legenda: **OFFLINE VALIDADO** = código e mocks/SQLite + CI; **IMPLEMENTADO, EXTERNO PENDENTE** = fluxos codificados sem contas ou aparelhos reais; **BLOQUEADO** = depende de autorização/provedor; **PARCIAL** = limite funcional explicitamente documentado. CI (evidência): https://github.com/kelwin-feitosa/Aurora/actions/runs/43583029640, com 152 testes aprovados, 0 falhas. Não é prova de homologação externa.

| ID | Critério | Situação 2.4 | Evidência e ressalva |
|---|---|---|---|
| H01 | Interface web/PWA | OFFLINE VALIDADO | Assets, manifest, SW, rotas estáticas e CI; navegador real pendente |
| H02 | Instalação por leigo | IMPLEMENTADO, EXTERNO PENDENTE | Wizard /instalar e npm setup; ainda exige provisionamento cloud e OAuth |
| H03 | Gmail institucional real | BLOQUEADO | Credenciais e consentimento institucional autorizados não fornecidos |
| H04 | Outlook institucional real | BLOQUEADO | Entra Graph/admin consent institucional não testado |
| H05 | Evento explícito | OFFLINE VALIDADO | Classifier + testes de agenda |
| H06 | Tarefa sem horário inferido | OFFLINE VALIDADO | All-day com data; sem invenção de horário |
| H07 | Remarcação e cancelamento | IMPLEMENTADO, EXTERNO PENDENTE | Confirmação manual e propriedade de evento verificadas em mocks |
| H08 | Várias datas na mensagem | PARCIAL | Até três propostas; acima exige revisão integral |
| H09 | Idempotência na re-sincronização | IMPLEMENTADO, EXTERNO PENDENTE | UNIQUE, outbox, IDs estáveis, testes de timeout; provedor real pendente |
| H10 | Mesmo título e datas diferentes | OFFLINE VALIDADO | Fingerprint com data e conexão |
| H11 | Corrigir/excluir próprio evento | IMPLEMENTADO, EXTERNO PENDENTE | Verificação de propriedade remota simulada |
| H12 | POST/PATCH incerto | OFFLINE VALIDADO | Estado unknown e reconciliação/contenção; real pendente |
| H13 | Cron, cursor e falhas | IMPLEMENTADO, EXTERNO PENDENTE | SQLite e mocks; agendador Cloudflare não validado |
| H14 | Sessões e revogação | OFFLINE VALIDADO | Cookies, registro hash, revogação, Push vinculado |
| H15 | Instalar PWA em dispositivos reais | BLOQUEADO | Android, iOS, PCs e browsers sem E2E real |
| H16 | Cache não armazena PII | IMPLEMENTADO, EXTERNO PENDENTE | SW offline restrito a assets; storage/browser real pendente |
| H17 | Desconexão OAuth | PARCIAL | Limpeza local implementada; revogação integral no provedor pode ser manual |
| H18 | Backup/restauração remota | IMPLEMENTADO, EXTERNO PENDENTE | Scripts e simulação; D1 Cloud com dados reais não ensaiado |
| H19 | Migração sem perda | IMPLEMENTADO, EXTERNO PENDENTE | 0017 aditiva e default 0; aplicar só após backup/restore de ensaio |
| H20 | 12 meses no Free | BLOQUEADO | CPU, rows D1, Google billing e tráfego real não foram medidos |
| H21 | Convites ICS adversariais | PARCIAL | Parser limitado com testes; recorrência e fuso arbitrário não completos |
| H22 | Conta institucional sem autorização | IMPLEMENTADO, EXTERNO PENDENTE | Fail-closed e mensagem para usuário; validar erro real |
| H23 | Triagem por conta + rescan | OFFLINE VALIDADO | 0016+0017, 40 casos adversariais, consentimento para full-read elegível |
| H24 | Push opcional e revogação | IMPLEMENTADO, EXTERNO PENDENTE | Criptografia ES256, sessão isolada, mocks; aparelhos não ensaiados |
| H25 | Reuso de delta Outlook | OFFLINE VALIDADO | $select e fallback, teste de GET redundante zero |
| H26 | Lockfile, auditoria e CI | OFFLINE VALIDADO | npm ci, npm audit, TypeScript, smoke e 152 testes pass no GitHub |
| H27 | ZIP privado e verificável | OFFLINE VALIDADO | git archive, unzip -t, SHA256SUMS e artifact no GitHub; retenção 7 dias |
| H28 | Segurança adversarial | PARCIAL | 40 casos artificiais, STRIDE e diffs; sem pentest independente |

## Critérios de aceite globais
- **GO:** revisar internamente a candidata offline, reproduzir CI, baixar ZIP privado.
- **NO-GO:** distribuição pública, uso institucional real, automação com From não autenticado, dados reais sem backup, afirmar custo zero por doze meses ou certificação de segurança.
- Implementação interna não substitui autorização institucional, evidência de segurança do provedor, avaliação de UX acessível, métricas Worker, aprovação de termos nem testes em dispositivos.

Dados e novas mudanças de schema só devem ocorrer sob backups auditados, com verificação de contagem/FK e ambiente isolado.
