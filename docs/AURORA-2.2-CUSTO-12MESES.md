# Sustentabilidade Free — hipóteses, não fatura

Cloudflare Workers Free: documentação oficial indica 100.000 solicitações/dia, 10 ms de CPU por execução, e limites separados de subrequisições e D1. O cron a cada 3 minutos gera até 480 invocações/dia (~175.200/ano) por instalação antes de retries e navegação. Isso não comprova que cada execução fique abaixo de 10 ms. As cotas de D1 incluem consultas por invocação, linhas e armazenamento, que exigem telemetria real.

**Estimativa por perfil:** 5 e-mails/dia/conta, 25, 50 e 100; 1 e 2 contas. Custos reais dependem da quantidade de polls, cache, movimentações, chamadas Graph/Gmail e uso de interface. O benchmark 30d mostrou que 2×50/dia pode ser atendido pelo modelo otimista com custo maior em chamadas; 2×100 deixa pendências; 2×200 é acima da capacidade estimada. NENHUMA promessa de 12 meses sem despesas ou de disponibilidade 24/7 é autorizada.

Serviços adicionais: Web Push sem intermediário pago, mas gateways de push podem impor políticas/quota e exigem VAPID e network; sem API de IA paga. Ao atingir limite, aplicação deve reconhecer atraso/pender ações, não gerar duplicatas ou ocultar falha.

Alternativas (Deno Deploy, Vercel Hobby, Supabase Free, Netlify, Render, Oracle Always Free, Apps Script) comparadas na pesquisa 2.1, cada uma com restrições distintas e eventual exigência de cartão. Não migrar de plataforma sem piloto equivalente e custos de suporte incluindo OAuth e atualizações pessoais.

Fontes que devem ser atualizadas na homologação: https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/d1/platform/limits/ ; https://developers.cloudflare.com/workers/platform/deploy-buttons/ .
