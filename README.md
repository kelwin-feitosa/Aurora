> **Estado:** Aurora 2.3 RC técnico, privado e sem homologação externa. Não dependa exclusivamente do Aurora para prazos essenciais. Ainda falta validar Cloudflare, Gmail/Outlook institucionais e dispositivos reais. O repositório não inclui credenciais nem dados de estudantes.

### Novidade 2.3 — modos por conta

O Aurora oferece **Acadêmico** (padrão), **Acadêmico ampliado** e **Pessoal** (opt-in). Em Conexões, configure remetentes e domínios permitidos/bloqueados por conta. A triagem por metadados reduz a leitura de corpo em mensagens claramente fora do escopo, mas pode descartar assuntos genéricos e aumenta chamadas para mensagens relevantes; use a reavaliação manual quando necessário. Assuntos sensíveis são desativados por padrão no modo pessoal. Veja [monitoramento e suas limitações](docs/MONITORAMENTO-2.3.md) e [benchmark](docs/BENCHMARK-MONITORAMENTO-2.3.md).

> **Status da versão 2.2:** 2.0 preservada. Novas migrações 0013–0015, agendamento adaptativo, diagnóstico de fila, onboarding verificável e Web Push genérico opt-in. **NÃO HOMOLOGADO para contas ou hospedagem reais.** Ver `docs/AURORA-2.2-RELATORIO.md`, `docs/AURORA-2.2-HOMOLOGACAO.md` e `docs/AURORA-2.2-TESTES.md`.

# Aurora 2.3.0-rc.1 — Instalação pessoal e notificações opcionais (pré-homologação)

> **Estado:** código executável com testes locais. **NÃO homologado para contas institucionais ou Cloudflare Free.** Não usar como única fonte de avisos de prova/estágio até validar OAuth e sincronização real.


## Novidades 2.0 — política de confiança e orçamento

- **Revisão humana por padrão:** mensagens de qualquer remetente não geram eventos automaticamente, mesmo que tenham data/hora explícitas. A opção `AUTO_APPROVE_MODE=trusted-senders` exige a lista exata `TRUSTED_SENDER_ADDRESSES=professor@exemplo.edu.br,...`; **From não prova autenticação de origem**. Use com cautela e prefira revisão manual.
- Google Calendar só reconcilia eventos com ID e `extendedProperties.private` próprios. Graph bloqueia busca de evento incompleta/paginação cruzada para não duplicar eventos.
- Reservas atômicas de mutação contam tentativas inclusive quando a resposta é perdida. Mensagens truncadas vão obrigatoriamente para revisão, e contas indisponíveis recebem backoff para não bloquear outras.
- Manutenção de banco executa em tick próprio, não misturada com sincronização; orçamento sintético inclui comandos em lotes. Há avaliação artificial com 68 mensagens e 81+ testes locais.
- A migração `0011` revisa itens automáticos ainda não enviados; `0012` adiciona agendamento de retentativa por conexão. Execute backup e migrações antes de atualizar.
- `npm run release:gate` verifica condições locais e falha corretamente enquanto falta lockfile, banco real ou PUBLIC_ORIGIN. **Não aprova OAuth ou Cloudflare reais.**

Veja [Relatório de auditoria 2.0](docs/AUDIT-2.0.md), [Segurança 2.0](docs/SECURITY-2.0.md), [Benchmark 2.0](docs/BENCHMARK-2.0.md), [Pesquisa e licenças](docs/RESEARCH-2.0.md), [Custos Free](docs/COST-2.0.md), [Instalação](docs/INSTALLER-2.0.md), [Matriz H01–H22](docs/MATRIZ-ACEITE-2.0.md) e [Plano de homologação](docs/HOMOLOGATION-2.0.md).

## Novidade: aplicativo para celular e computador

O Aurora mantém uma **PWA instalável** com um único frontend para Android/iOS/Windows/Linux/macOS, conforme o navegador. Não há APK/EXE nem app publicado nas lojas. Um servidor pessoal permanece responsável pelo monitoramento; instalar a PWA não cria automaticamente hospedagem.

### Como experimentar localmente

Node.js 22.10+; ambiente com npm e acesso às dependências de desenvolvimento para instalar em máquina nova.

```bash
npm install
npm run setup
npm run dev
```

Acesse http://localhost:8787 e use a senha gerada pelo assistente. Há uma demonstração **sem dados reais** em `/demonstracao` e um instalador orientativo em `/instalar` (ou abrindo o arquivo `INSTALAR_AURORA.html` diretamente).

### Testar

```bash
npm run build
npm test
npm run verify
```

Os testes de integração utilizam provedores simulados, nunca credenciais verdadeiras.

### Distribuição pessoal

Consulte [Instalação](docs/INSTALACAO.md), [Cloudflare](docs/DEPLOY-CLOUDFLARE.md), [Gmail](docs/OAUTH-GOOGLE.md) e [Outlook](docs/OAUTH-MICROSOFT.md). A criação de clientes OAuth e a autorização institucional não podem ser substituídas por cliques de um instalador.

### Privacidade

Apenas recursos públicos são colocados no cache da PWA; APIs privadas, sessões, nomes de disciplinas, eventos, e-mails e tokens nunca são armazenados no CacheStorage. O usuário continua tendo que fazer login com a senha longa de sua instância; cookies de sessão são HttpOnly e revogáveis.

### Como manter a aplicação atualizada

Reveja a versão do código e do banco antes de atualizar. Migrações devem ser aplicadas com backup. Confira [Atualização](docs/UPDATING.md). A PWA avisa quando há um service worker novo, mas o servidor precisa ser atualizado separadamente.

### Referências e limites

- Gmail e Outlook implementados com adaptadores independentes, **não testados com contas institucionais reais**.
- Cloudflare Workers + D1 continua a primeira opção a validar; o banco está configurado com UUID de exemplo que deve ser substituído.
- Sem IA paga obrigatória: classificação conservadora por regras e revisão humana.
- O serviço não é adequado ainda como fonte exclusiva de compromissos; mantenha o calendário original e consulte os e-mails quando a conexão estiver indisponível.

## Recursos adicionados na 1.6

- Mensagens com **dois ou três compromissos** geram propostas distintas para revisão humana; quatro ou mais itens ambíguos são encaminhados para revisão sem truncamento silencioso. **Não há publicação automática desses casos.**
- Importação limitada e segura de `text/calendar` / `.ics` Gmail e Outlook (subconjunto de RFC 5545): eventos recorrentes, alterações, cancelamentos e fusos desconhecidos permanecem em revisão; não é leitor genérico de anexos.
- Exportação de registros por páginas até percorrer todos os itens acessíveis, excluindo tokens; o JSON **não** substitui backup SQL completo.
- Identidade de evento e confirmação manual com bloqueio transacional de duplicatas; limpeza de excertos pessoais novos e históricos na migração `0010`.
- Visão de sessões com revogação de outros dispositivos; cotas visíveis e advertências de consumo.
- Backup **D1 remoto** via exportação Wrangler, cifragem local AES-256-GCM + scrypt, restauração somente em banco **novo e comprovadamente vazio**, com conexões e ações remotas em quarentena; **testado apenas com CLI simulada**, não em Cloudflare real.
- Testes adicionais de casos adversariais e recuperação; mantenha todos os bloqueios externos antes de anunciar produção.

Para backup/restauração, consulte [Backup e recuperação](docs/BACKUP-RESTORE.md). Para a situação honesta da versão, consulte [Matriz final](docs/FINAL-AUDIT-1.6.md).

## Recursos já implementados

- Dois adaptadores REST independentes, Gmail e Microsoft Graph; Gmail `historyId` e Outlook `delta` para sincronização incremental, com checkpoint atômico e cron de 3 minutos com verificação de caixa ociosa a cada ~15 minutos, e antecipação quando a paginação indica backlog.
- OAuth Authorization Code + PKCE + estado de uso único; refresh token cifrado com AES-GCM em D1/SQLite, associado à identidade da conexão.
- Sessões revogáveis por registro no banco, cookies `HttpOnly; Secure; SameSite=Lax`, vínculo OAuth à sessão, controles de origem, CSP, rate limit de login e endpoints privados.
- Classificador determinístico PT-BR conservador, sem IA paga, que não inventa datas; reconhece eventos com data/hora completos e tarefas com prazo conhecido.
- Tarefas de prazo como lembretes de **dia inteiro**, eventos como compromissos, avisos informativos e fila de confirmação para ambiguidades.
- Calendário exclusivo com identificação por conexão, chave de evento estável, outbox durável, verificação antes de recriar e bloqueio quando um POST tem resultado incerto; correção/cancelamento manual de eventos próprios com novo diário de operações.
- Interface responsiva em português, onboarding de contas, atividades, situação da sincronização, lembretes configuráveis, revisão manual, exportação e desconexão.
- `INSTALAR_AURORA.html` para orientar a hospedagem em cliques; script local `npm run setup`; testes offline com APIs simuladas e benchmark reproduzível.

## Como começar

**Sem programação:** abra `INSTALAR_AURORA.html`. Ele orienta o deploy no seu próprio Cloudflare e a autenticação OAuth oficial, explicando o que ainda exige configurações externas. **A experiência de um clique não está pronta:** um repositório público e registros OAuth aprovados ainda são necessários. Leia [Instalação](docs/INSTALACAO.md).

**Desenvolvimento local:** requer Node.js 22+.

```bash
npm install
npm run setup
npm run dev
```

Abra `http://localhost:8787`. O servidor local usa SQLite e escuta somente `127.0.0.1`. Para rodar testes sem credenciais reais:

```bash
npm run build
npm run typecheck
npm test
npm run bench
npm run security:check
npm run smoke:http
npm run bench:d1  # contador de SQL sintético, não telemetria Cloudflare
npm run schema:status  # com servidor local desligado, se existir aurora-local.db
```

**Nunca anexe e-mails reais, refresh tokens, chaves, arquivos `.dev.vars`, bancos ou backups ao repositório.** O Aurora não captura a senha do Gmail/Outlook; seu uso exige autorização legítima do titular e da instituição quando aplicável.

## Hospedagem individual gratuita

Preferência: Cloudflare Workers Free + D1, se os testes de CPU e orçamento confirmarem adequação. O plano Free possui limites; o projeto restringe por padrão o processamento a até 2 mensagens por conexão e ciclo (configurável com `SYNC_LIMIT`, padrão 1); uma conta processada a cada cron, 200 leituras de mensagem/dia, 30 gravações no calendário/dia, 500 tentativas de API por dia e até 16 tentativas de API por ciclo. Esses limites **não garantem** permanência em um plano grátis se políticas e cotas mudarem, nem incluem automaticamente cotas D1/CPU; o medidor de chamadas de API cobre tentativas da rotina agendada, não configuração OAuth nem requisições do navegador. O aplicativo não usa API paga de IA nem serviço externo de analytics. [Custos e limites](docs/CUSTOS.md).

## Organização

- `src/domain`: interpretação acadêmica e escaping.
- `src/providers`: Gmail, Graph, OAuth, REST com allowlist.
- `src/app`: sincronização, idempotência, outbox.
- `src/infra`: SQL, criptografia, sessões.
- `src/web`: interface estática, API e build sem framework.
- `migrations`: esquema D1 e SQLite.
- `scripts`: configuração, servidor local, diagnósticos.
- `tests`: unitários, segurança e integração simulada.
- `bench`: medição de operações locais.
- `docs`: segurança, privacidade, implantação, status e evidências.

## Dependências e limitações

O runtime do Worker usa APIs nativas e não depende de LLM. `typescript` e `wrangler` são ferramentas de desenvolvimento/deploy. A geração de `package-lock.json`, a auditoria de dependências via registry e o deploy real ficaram pendentes porque o ambiente desta entrega não tinha acesso ao registry npm nem credenciais de nuvem. Não é uma release de produção validada. Veja [limitações](docs/KNOWN_LIMITATIONS.md), [release 1.2](docs/RELEASE-1.2.md) e [migrações](docs/MIGRATION-1.2.md).

## Fontes técnicas

[Cloudflare Workers Free](https://developers.cloudflare.com/workers/platform/limits/) · [Deploy button](https://developers.cloudflare.com/workers/platform/deploy-buttons/) · [Gmail sync](https://developers.google.com/workspace/gmail/api/guides/sync) · [Graph delta](https://learn.microsoft.com/en-us/graph/delta-query-messages) · [Google OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)

Licença MIT. Autoria própria do código deste pacote; nenhum projeto terceiro foi copiado em bloco. Consulte [avisos de terceiros](docs/THIRD_PARTY_NOTICES.md).
