# Migração 1.1 → 1.2 (dados preservados)

**Primeiro pare a instalação e faça backup.** Nunca copie o `APP_SECRET` para o ZIP ou repositório público; preserve-o separadamente para que os tokens continuem descriptografáveis.

## SQLite local

1. Pare `npm run dev`.
2. Faça backup cifrado existente (`npm run backup:local`, se configurado) e cópia offline do arquivo SQLite, restrita ao titular.
3. `npm run schema:status` para ver migrações pendentes, sem alteração.
4. `node --experimental-sqlite scripts/schema-status.mjs --apply` aplica **somente as migrações novas**, mantendo uma cópia pré-migração `*.pre-aurora-1.2.bak`.
5. Reinicie o servidor, entre novamente e confira `/api/data`, sessões, sincronização e ações.
6. Teste restauração isolada antes de remover backup. Não restaure sobre um processo com o banco aberto.

## Cloudflare D1

1. Fazer backup/snapshot com mecanismo oficial e validar o arquivo recuperável.
2. Em staging, `wrangler d1 migrations apply AURORA_DB --remote`; revisar alterações e verificar tabelas `sessions`, `calendar_changes`, coluna `usage_daily.provider_calls` e `runtime_state`.
3. Conferir as integrações com conta de teste, depois liberar instância pessoal. **Não foi executada migração D1 remota nesta missão.**

## Compatibilidade

A migração mantém as tabelas e dados 1.1, acrescentando `0006`–`0009` em ordem; não recria conexões ou eventos. Como os cookies antigos eram stateless, **o usuário terá de entrar novamente** após a atualização. Estados OAuth pendentes anteriores, sem `session_hash`, não poderão ser concluídos e precisarão ser reiniciados por segurança. Se houver um erro durante a migração, não repita sem identificar a causa: restaure cópia e revise logs sanitizados.

## Evidência

Teste `migração incremental 1.1 → 1.2 preserva dados` em `tests/integration.test.mjs` cria banco com as migrations antigas e abre com as novas; consulta o registro existente e as tabelas acrescidas. Não representa teste remoto em D1.
