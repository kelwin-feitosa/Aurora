# Backup, restauração e recuperação — Aurora 1.6

## SQLite local — implementado e validado em testes locais

Pare o servidor antes de restaurar. `npm run backup:local` gera um arquivo `.aurbk` cifrado com AES-256-GCM; a chave é derivada do `APP_SECRET`. Guarde a chave separada do backup. Use `npm run restore:local -- /caminho/backup.aurbk` para verificar e `npm run restore:local -- /caminho/backup.aurbk --apply --replace` somente com o servidor PARADO e após preservar a instalação atual. Conexões são suspensas e operações remotas pendentes bloqueadas após restaurar. O backup só funciona com segredo correspondente.

## D1 remoto — scripts implementados, ensaio somente SIMULADO

**Não executado em uma conta Cloudflare real.** É obrigatório obter backup e testar restauração com dados sintéticos autorizados antes de armazenar dados institucionais. O D1 Free documenta janela de **7 dias de Time Travel**; isso NÃO é retenção ilimitada nem substitui cópia externa cifrada. Fonte: <https://developers.cloudflare.com/d1/reference/time-travel/>.

Pré-requisitos: CLI `wrangler` instalada e autenticada, permissão para exportação D1 remota, base corretamente configurada, Node.js 22+, lugar privado para guardar o backup e **senha forte separada de pelo menos 20 caracteres** (variável `AURORA_BACKUP_PASSPHRASE`). **Nunca** cole a senha na linha de comando nem commite o arquivo.

### Backup remoto (somente leitura do banco ativo)

```bash
export AURORA_BACKUP_PASSPHRASE='INSIRA_A_SENHA_FORTE_NESTA_SESSAO_PRIVADA'
npm run backup:cloud -- --confirm-remote-read --output=/local/privado/aurora.aurd1 --database=AURORA_DB
```

O script usa `wrangler d1 export --remote`, grava SQL transitório em diretório privado, cifra autenticadamente com AES-256-GCM/scrypt e apaga o temporário. Se houver erro, falha sem sobrescrever backup existente. **Limitação atual: backups SQL acima de 16 MiB são recusados** (não truncados); dimensione o banco antes de usar. O backup cifrado inclui dados sensíveis do banco: proteja e guarde em local separado. O script depende do formato de saída do Wrangler a ser validado com a versão instalada.

### Preparar recuperação offline (não altera banco)

```bash
npm run restore:cloud:prepare -- /local/privado/aurora.aurd1 --output=/local/privado/restore-quarentena.sql --confirm-plaintext
```

Um arquivo SQL **em claro** é criado com privilégios locais restritos: trate-o como segredo sensível e apague-o após recuperação. A SQL de quarentena desativa conexões, bloqueia outbox e mudanças pendentes e revoga sessões. O processo só foi validado com dados e ferramentas simulados.

### Restaurar SOMENTE em um banco D1 NOVO, vazio e isolado

```bash
npm run restore:cloud:new -- /local/privado/aurora.aurd1 \
  --database=aurora-restauracao-teste \
  --confirm-new-empty=aurora-restauracao-teste \
  --confirm-remote-write
```

O comando exige confirmações explícitas, verifica via consulta de leitura o número de tabelas do alvo e rejeita banco não vazio. **Não restaura sobre o D1 ativo.** Depois: audite manualmente o banco novo, teste integridade/tokens/secret `APP_SECRET`, compare calendário remoto, avalie filas e somente então altere bindings em manutenção planejada. O script não troca o binding nem reativa contas automaticamente. O alvo precisa ser criado externamente e o formato de respostas do Wrangler validado no ambiente real.

**Teste efetivamente executado:** backup cifrado, senha errada, adulteração, SQL de quarentena e CLI Wrangler simulada, incluindo rejeição de banco ocupado. **Não testado:** export real, import real, integridade e permissões em Cloudflare, migração/cutover D1 real e compatibilidade com todos os tamanhos de bancos.

## Exportação no aplicativo não é backup

O botão “Exportar dados” faz paginação e entrega JSON sem credenciais OAuth; não contém estado completo de banco/outbox, tokens ou secrets. Para migração ou desastre use o procedimento próprio de backup, com verificação da instalação antes de restaurar.
