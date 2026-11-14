# Relatório de implementação — Missão Aurora 1.2

Data: 12/11/2026. Base imutável: `AURORA_1.1_CODIGO_EXECUTAVEL_E_INSTALADOR.zip` (SHA-256 `5fac40bfed23bc401b7a4ba335dc6b1f84ea0d17b97a700287196f5926217e18`). Código modificado em diretório separado `aurora-1.2`.

## Mudanças efetivas (não apenas propostas)

1. **Segurança:** sessões servidor-revogáveis com ID hash em SQLite/D1, logout revoga token copiado; OAuth state vinculado à sessão inicial, cookie Lax preservado; proteções de URL provider e limites de 512 KiB/12 s no parse REST; limite de 8 KiB no corpo JSON e no dev-server; arquivos SQLite locais com permissão 0600 no Linux.
2. **Sincronização:** erros permanentes de autenticação suspendem conexão, cinco falhas de mensagem param retries automáticos e exibem possibilidade de tentar de novo; cooldown para `POST /api/sync`; refresh token com CAS e releitura em corrida.
3. **Calendário:** nova tabela `calendar_changes`, correção/cancelamento manual de evento próprio em ambos provedores, comparação de `source_id` Gmail ou `transactionId` Graph antes de alteração, fila durável com verificação/reconciliação, bloqueio para respostas incertas e UI de confirmação.
4. **Free-first:** contador de tentativas externas, inclusive 429/falhas de rede, com orçamento 500/dia e 16/ciclo aplicado ao scheduler; uma conta priorizada por último sync (fairness, polling alternado), `SYNC_LIMIT` 1–2 refs/conexão (padrão 1); payloads de respostas limitados. Não mensura CPU/D1 automaticamente.
5. **Engenharia:** migrações 0006–0009 preservando dados, script de diagnóstico de schema/backup antes de upgrade, rotina estática de artefatos, documentação atualizada e incremento de testes de 26 para 37.

## Evidência de verificação

- `npm run build`: aprovado local.
- `npm run typecheck`: aprovado com TypeScript global instalado no ambiente.
- `npm test`: **37/37** testes aprovados com Node v22.16.0, SQLite nativo e HTTP simulado.
- `npm run verify`: aprovado localmente (com avisos explícitos do doctor sobre OAuth/lockfile).
- `npm run security:check`: inspeção estática de arquivos sensíveis passou; **não** é SAST completo.
- Smoke HTTP local via curl e `npm run smoke:http`: página `200`, sessão anônima `200`, login `200`, `/api/data` autenticado `200`, logout `200`, cookie original após logout `401`.
- `bench/results.json`: classificação e SQLite medidos offline; `npm run bench:d1` verificou 36/35 comandos SQL em dois ciclos sintéticos com duas contas; ver `bench/COMPARE-1.1-1.2.md`.
- Migração 1.1 → 1.2: teste local com banco persistente temporário e preservação de registro.
- Backup/restore cifrados: execução isolada de backup, pré-visualização e restauração; confirmou `enabled=0` e mudanças pendentes bloqueadas.

## Gates

| Gate | Status | Bloqueio |
|---|---|---|
| Código/segurança offline | APROVADO CONDICIONAL | 37/37 testes, sem revisão externa |
| Gmail real | BLOQUEADO EXTERNO | escopos Google, conta consentida, autorização CEUB |
| Outlook real | BLOQUEADO EXTERNO | aprovação UDF/tenant e conta consentida |
| Cloudflare Free real | NÃO TESTADO | Worker/D1 sem deploy ou telemetria |
| CI reprodutível | INCOMPLETO | sem package-lock/npm registry |
| Navegador real | NÃO TESTADO | smoke HTTP não substitui Playwright/mobile |
| Segurança independente | NÃO TESTADO | sem pentest/SAST online |
| Dados/backup remoto | NÃO TESTADO | restauração D1 pendente |

**Não confundir este release técnico com aplicativo pronto para produção.** Também não houve criação de repositório ou deploy externo.
