# Divulgação responsável de vulnerabilidades

O Aurora ainda é um **release candidate técnico não homologado**, sem testes institucionais e Cloudflare reais. Não armazene e-mails de terceiros ou utilize dados pessoais reais em instalações de teste sem consentimento.

Para comunicar uma vulnerabilidade antes de tornar o repositório público, utilize um contato privado com o mantenedor via GitHub. **Não abra uma issue pública contendo tokens, dados pessoais, dumps, senhas ou informações exploráveis.** Caso o recurso de relatórios privados de vulnerabilidade esteja disponível, prefira-o.

Em caso de exposição de segredo: suspenda as credenciais afetadas, revogue tokens nos provedores oficiais, rotacione as chaves aplicáveis, analise logs sem copiar corpos de e-mail e só então restaure a operação após validação. Não presuma que apagar um arquivo do Git elimina seu histórico.

Escopo de segurança: OAuth PKCE, criptografia de tokens, sessões revogáveis, triagem por metadados e Web Push opt-in. Limitações conhecidas: escopos Gmail restritos; políticas institucionais; testes de navegador/dispositivo/Cloudflare ainda não realizados; lockfile indisponível neste ambiente; triagem baseada em assunto não autentica remetente.
