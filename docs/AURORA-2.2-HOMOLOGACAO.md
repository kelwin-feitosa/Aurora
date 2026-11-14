# Matriz de decisão GO / NO-GO para piloto e público

**NO-GO atual (verificado):** não existem prova de OAuth Gmail/Outlook institucionais, deploy real Workers/D1, latência/CPU real, entrega de push em iPhone/Android, auditagem SCA/npm lockfile, testes de acessibilidade com navegador real, onboarding mobile-only e restauração remota em D1. Portanto, a entrega é RC para testes locais, NÃO produção.

## Para começar piloto pessoal (contas autorizadas)

- [ ] Criar instância Cloudflare Free em conta de teste; provar `workers.dev` HTTPS, D1 provisionado e migrações 0001–0015 aplicadas.
- [ ] Medir CPU p50/p95/p99 no Workers, SQL D1 efetivo (incluindo `runtime_state`/push), subrequests, rows read/write, memória, e erro/limite real em carga representativa por 30 dias, 1 e 2 contas.
- [ ] Validar Gmail OAuth e escopos restritos com autorização real; recusar se a instituição bloquear; verificar expiração Gmail historyId e sync de 30 dias após outage.
- [ ] Validar Outlook Entra e Graph delta por pasta, consentimento institucional, expiração e paginação, sem credenciais no log.
- [ ] Verificar criação/cancelamento remotos, reenvio após resposta perdida, isolamento entre provedores, backup cifrado e restauração em D1 NOVO e vazio com quarentena.
- [ ] Corrigir falta de package-lock legítimo, `npm ci` e `npm audit`/SCA/SBOM com rede autorizada.
- [ ] Instalar PWA e habilitar/desabilitar push em Android, iPhone (Home Screen iOS 16.4+) e desktop; testar 410, 429, fuso, modo silencioso, telefone desligado, lockscreen neutra e ausência de duplicatas.
- [ ] Testar onboarding com 3 estudantes leigos consentidos; medir cliques, sucesso sem ajuda e tempo, não alterar as configurações da instituição.

## Para publicação ampla

- [ ] Resolver integralmente política Google OAuth restricted scopes e, quando aplicável, security assessment; Microsoft multi-tenant e consentimento por organização.
- [ ] Definir política de privacidade, titularidade/responsabilidades, custos operacionais, atualização de centenas de instâncias e resposta a incidentes.
- [ ] Nenhum P0/P1 conhecido, objetivos mensurados de atraso aceitáveis e sem perda de compromissos críticos em amostra consentida.

Qualquer gate falhando → registrar evidência, impacto e contingência segura, sem declarar sucesso de produção.
