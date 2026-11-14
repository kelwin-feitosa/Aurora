# Instalação individual guiada

## Qual instalação você deseja?

- **Hospedagem pessoal**: uma vez por usuário, servidor e banco na sua conta Cloudflare (ainda não validado em conta real).
- **Aplicativo no celular/PC**: abre a mesma URL da sua hospedagem e instala pela opção do navegador. Não precisa instalar Node no telefone.

## Assistente disponível

Abra `INSTALAR_AURORA.html` no computador ou a rota `/instalar` depois de publicar a instância. O assistente informa o fluxo de autorização por provedor, gera segredos criptograficamente aleatórios no navegador (não são transmitidos), mostra callbacks corretos e direciona ao deploy oficial. **Ele não consegue criar por si só um cliente OAuth, aplicar migrations remotamente nem obter consentimento institucional.** Não contém um botão de deploy funcional pré-configurado porque o projeto não foi publicado em um repositório público.

## Etapas externas obrigatórias (sem terminal quando o fluxo oficial permitir)

1. Criar conta gratuita na Cloudflare e hospedar o projeto via repositório público próprio com o fluxo oficial Deploy to Cloudflare; se esse recurso não provisionar o banco, configurar D1 no dashboard/CLI, conforme documentação vigente.
2. Configurar `DB`, `PUBLIC_ORIGIN` (HTTPS exato), `APP_SECRET` e `INSTALLATION_PASSPHRASE` usando secrets; não usar dados de exemplo da base ou senhas de teste. Aplicar migrações na ordem correta, com backup antes de atualizações.
3. Na Google Cloud ou no Microsoft Entra, configurar os clientes OAuth, redirect URLs exatas `/api/oauth/callback/gmail` e `/api/oauth/callback/outlook`, escopos exigidos e consentimento oficial. A organização pode bloquear esta autorização.
4. Abrir o Aurora, entrar com a senha da instância e autorizar a conta Gmail ou Outlook na página oficial; nunca digitar senha institucional no Aurora.
5. Acessar Instalação e ajuda → Verificar novamente; o sistema informará DB, OAuth configurado, conexões e últimas execuções de cron. Isso não equivale a um teste real de leitura e escrita.
6. Confirmar, com calendário de teste próprio e mensagens de teste sem informações sensíveis, que novos compromissos e remarcações funcionam; repetir em ambas integrações conforme disponibilidade.
7. No celular/PC, abrir mesma URL HTTPS e instalar pelo navegador quando suportado.

O aplicativo também possui demonstração `/demonstracao` com dados totalmente sintéticos.

## Limites

Sem repositório público publicado, não há botão único de provisionamento validado. O UUID D1 em `wrangler.jsonc` é placeholder. Não declarar a instalação concluída apenas porque o assistente foi percorrido.
