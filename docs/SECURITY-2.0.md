# Aurora 2.0 — Revisão adversarial de segurança

**Alcance:** código local e HTTP simulado, não pentest externo, SAST independente, revisão LGPD formal ou auditoria de dependências npm. Não existe garantia de ausência de vulnerabilidades.

| Ameaça | Situação anterior | Correção 2.0 | Risco residual |
|---|---|---|---|
| Evento externo com ID igual ao calculado pelo Aurora | GET por ID Google era tomado como prova de criação | GET exige `extendedProperties.private.aurora==='1'` e `source_id` exato | Provedor real ainda não testado; usuário pode alterar evento manualmente |
| Evento legítimo além da 5ª página Graph | Busca incompleta retornava `null`, possibilitando segundo POST | Falha fechada `GRAPH_EVENT_RECONCILIATION_INCOMPLETE` | Pode bloquear ações até revisão; não há varredura ilimitada |
| `nextLink` Graph malicioso | Caminho de calendário aceito por prefixo | Caminho do calendarView igual ao calendário alvo, host/porta/credenciais validados; delta path exato | Sem integração Graph real |
| JSON OAuth excessivo | `resp.json()` sem limite de bytes | Leitura limitada a 64 KiB, inclusive stream sem Content-Length | Carga comprimida e comportamento de proxy devem ser medidos remotamente |
| E-mail com prova falsa para criar evento | Classificação automática permitia texto de qualquer remetente | **Revisão humana por padrão**; opt-in exact allowlist via configuração; teste com injeções textuais | From NÃO comprova autenticidade; sem validação DKIM/SPF de ponta a ponta. Opt-in é decisão de risco do usuário |
| Mensagem truncada com prazo fora do fragmento | Conteúdo cortado podia ser tratado como integral | Marca `textIncomplete`; não cria eventos antes de revisão | Parsing RFC822 completo e qualidade real do MIME ainda limitados |
| Data contraditória `14:00` e `16:00` | Comparação buscava apenas `h` | Detecta horas `h` e `:` conflitantes | Linguagem natural complexa ainda exige avaliação humana |
| Fila automática anterior à atualização | `approved` podia continuar criando sem política nova | Migração 0011 reclassifica itens não enviados sem aprovação humana | Operações `unknown` não são refeitas automaticamente; precisam reconciliação |
| Cota de gravação do calendário | Contador aumentava apenas após resposta de sucesso; corrida entre GET/UPDATE | Reserva SQL condicional atômica **antes** da chamada; conta tentativas incertas | Cotas reais dos provedores distintas; sem benchmark em nuvem |
| Falha persistente em uma conta | Conta antiga podia monopolizar cron, atrasando outras | `next_sync_at` com backoff por conta; migração 0012 | Latência de até múltiplos ciclos, eventualmente requer intervenção |
| Corpo HTML e prompt injection | HTML transformado em texto, sem LLM habilitada; risco de classificação indevida | Restrições de ação por política e testes de API; texto não adquire privilégios | Não executamos corpus de ataque real; extensões LLM futuras exigem nova auditoria |
| Cache PWA | Rotas privadas excluídas | Política existente preservada/testada | Browser real não disponível neste ambiente |

## Invariantes a preservar

1. Nunca enviar refresh token, corpo do e-mail ou segredos ao cliente, logs, cache PWA ou respostas de erro.
2. `email.sender` é dado externo, não autorização; a automação com allowlist é somente opt-in e não garante anti-spoofing.
3. Não repetir POST/PATCH/DELETE após resposta desconhecida sem reconciliação confirmada. Não procurar evento por título como prova de propriedade.
4. Outbox, inbox e cursor persistem antes de ações irreversíveis; falhas retornam a revisão/retentativa com limites.
5. Ações destrutivas solicitadas pelo usuário exigem confirmação e prova de que o evento pertence à instalação.
6. APP_SECRET e senhas não entram em commits, pacotes ou sistemas de coleta; backup precisa preservar o segredo fora do mesmo arquivo.

## Pendências P0 para liberar produção

- Testes autorizados com contas Gmail e Graph e confirmação de escopos, `transactionId`, `extendedProperties` e calendários reais.
- Registrar pacote de dependências com lockfile verificado, instalar via `npm ci`, executar `npm audit` e SAST externo.
- Teste D1 real para quotas, recuperação, backups, CPU por invocação e comportamento das migrações.
- Testes de browser/dispositivos reais; acessibilidade assistiva e política de consentimento.
- Política de confiança de remetente autenticado (DKIM/DMARC onde possível) **antes de recomendar opt-in amplo**. Não prometer criação automática completamente segura com base no `From`.
