# Roteiro de validação em dispositivos reais — pendente

| Ambiente | Procedimento | Resultado desta execução |
|---|---|---|
| Android Chrome | HTTPS → instalar → login → trocar abas → fechar/abrir → offline → online | NÃO TESTADO em dispositivo |
| iOS Safari (16.4+) | Compartilhar → Adicionar à Tela de Início → login → offline → online | NÃO TESTADO em dispositivo |
| Windows Chrome/Edge | Menu Instalar → abrir janela app → login → logout → revogação | NÃO TESTADO |
| Linux Chrome/Edge | Instalar como app → testar teclado e acessibilidade | NÃO TESTADO |
| macOS Safari/Chrome | Adicionar ao Dock/instalar quando suportado | NÃO TESTADO |
| Firefox desktop | Navegação responsiva sem promessa de instalação nativa | NÃO TESTADO |
| Chromium gerenciado deste ambiente | Playwright tentou acessar localhost; política bloqueou todas as URLs | BLOQUEADO por política administrativa |

Outros casos: verificar `manifest` válido, orientação em iOS sem botão falso, service worker ativo, atualização não apagando formulário, cachê contendo só recursos públicos, dados API não disponíveis sem sessão, foco do modal e ordem de leitura, contraste WCAG 2.2 AA com axe se disponível, toque em 320/375/768/1280 px, offline neutro. Documentar versões exatas, evidências e falhas; testes locais não bastam para marcar aprovado.
