# Instalação Aurora 2.0 RC — orientação para usuário final e administrador

**Status:** instalação assistida, **não** instalador universal de um clique. O software funciona no navegador e pode ser instalado como PWA onde o navegador oferece suporte. O celular não precisa estar ligado para o servidor agendado sincronizar: isso só se mantém se a hospedagem remota estiver corretamente implantada.

## Teste em computador de desenvolvimento

1. Instale Node.js 22.10 ou superior (verifique `node -v`).
2. Na pasta `aurora`, abra `INSTALAR_AURORA.html` para ler o fluxo guiado, ou execute `npm run setup` para criar o arquivo local de segredos, sem transmiti-los.
3. Em uma máquina com acesso normal ao registry, instale as dependências com versões verificadas: **antes do lançamento gere e versione `package-lock.json` legítimo**, instale com `npm ci` e execute `npm audit`. Neste ambiente, a criação/validação de lockfile estava bloqueada.
4. Execute `npm run verify` e `npm run dev`; acesse o endereço local exibido pelo programa. Faça login com a senha da instalação gerada/configurada.
5. O modo padrão de automação é `AUTO_APPROVE_MODE=review`. **Não** ligue `trusted-senders` se não compreender o risco de spoofing do remetente.
6. Não use uma caixa de e-mails acadêmica real até que o OAuth tenha sido autorizado e testado.

## Instalar no Android, iPhone e PC

Com backend publicado em HTTPS e manifesto servidos, abra o endereço pessoal no Chrome/Edge ou Safari compatível e siga o menu do navegador para instalar ou adicionar à Tela de Início. O recurso exato varia conforme plataforma e versão; não prometer botão universal. A PWA é um *cliente* do Worker; não instala o sincronizador dentro do telefone.

## Cloudflare pessoal (somente quando autorizado a implantar)

1. Crie uma conta Cloudflare de propriedade do usuário e confira os termos e quotas Free atuais.
2. Crie um banco D1 e substitua o `database_id` de exemplo no arquivo Wrangler. Use *primeiro* banco de ensaio.
3. Configure `PUBLIC_ORIGIN` com a URL HTTPS real e segredos em mecanismo oficial de secrets, não em arquivos do Git/repositório público.
4. Configure credenciais OAuth via consoles oficiais Google/Microsoft; políticas de contas educacionais e consentimento de administradores podem bloquear a conexão.
5. Aplique migrações em sequência antes da primeira execução, faça smoke e teste todos os pontos críticos com contas autorizadas. Ative o cron somente depois da verificação.
6. Execute `npm run release:gate`; a validação local só pode avançar quando banco, origem e lockfile deixam de ser exemplos. **Mesmo gate verde não prova aprovação institucional, desempenho real ou segurança final.**

## Backup e atualização

Antes de atualizar a instalação, crie backup criptografado, ensaie restauração em banco novo, desative cron e aplique migrações 0011 e 0012. Ver [UPGRADE-2.0.md](UPGRADE-2.0.md). Nunca enviar o segredo mestre no mesmo arquivo que o banco exportado.

## Para quem não programa

Use o assistente HTML como guia visual. Ainda são necessárias etapas externas legítimas para criar contas, registrar OAuth, escolher permissões e configurar infraestrutura. Nenhum programa pode aprovar permissões institucionais por outra pessoa. Se essas etapas bloquearem, mantenha o Aurora em modo de demonstração ou teste local sem dados reais até assistência autorizada.
