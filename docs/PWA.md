# PWA e isolamento de dados

## Plataforma

A mesma URL HTTPS funciona no desktop e no celular; uma PWA instalada é o cliente, não a hospedagem. Android (Chrome/Edge/Samsung compatível): usar o menu do navegador ou o botão quando `beforeinstallprompt` estiver disponível. iOS: Compartilhar → Adicionar à Tela de Início; o evento `beforeinstallprompt` não está disponível no iOS. No desktop, Chrome e Edge permitem instalar; Firefox desktop pode continuar usando o site.

## Cache

`src/web/sw.js` aceita somente os caminhos estáticos enumerados em `STATIC`. Nenhuma rota `/api`, `/oauth`, navegação HTML ou payload privado é escrita em CacheStorage. A página offline é genérica; nenhum compromisso antigo é apresentado como atual.

## Atualizações

O cache público tem versão `aurora-public-v1.5.0`. Ao publicar uma alteração estática, aumentar a versão e executar `npm run build`; quando o novo service worker é instalado, a interface pede confirmação para atualizar antes de recarregar.

## Notificações

Usamos lembretes nativos dos calendários Google/Outlook. Não implementamos Web Push nesta versão: adicionaria chaves VAPID, armazenamento de subscriptions e operações recorrentes, aumentando risco e consumo. Uma futura implementação deverá ser opt-in e passar por testes reais em iOS/Android.

## Testes

`npm test` inclui testes dos endpoints de manifesto/ícones, isolamento de cache e modo privado. O ambiente desta execução possui Chromium sob política `URLBlocklist: ["*"]`, que impede abrir localhost. Compatibilidade visual/instalação real requer rodar os roteiros `docs/QA-DISPOSITIVOS.md` num navegador sem essa restrição.
