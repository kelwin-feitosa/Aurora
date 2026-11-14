# Monitoramento por conta — Aurora 2.3 RC

## O que foi implementado

- `academic_strict` (**padrão**): triagem com assunto/remetente; aceita assuntos com evidências acadêmicas ou fontes explicitamente incluídas. **Não se limita a `.edu.br`.**
- `academic_extended` (**opt-in**): acrescenta cursos, pesquisas, bolsas, seleção, eventos e carreira.
- `personal` (**opt-in por conta**): pode considerar compromissos e prazos não acadêmicos. Saúde/finanças começam desativadas; o usuário deve ativá-las explicitamente para sujeitos reconhecíveis.
- Permissões, bloqueios e fontes individuais por conta, com validação estrita e bloqueio de conflitos.
- Gmail: `messages.get?format=metadata` com `metadataHeaders=Subject,From` antes de buscar `format=full`; Microsoft Graph: `$select=id,subject,from,receivedDateTime` antes da leitura de `body`. Todos os métodos usam a autorização que o usuário já concedeu.
- Submetemos todos os compromissos pessoais/ampliados à **revisão humana**, sem criação automática.
- Mensagens que não passaram pela triagem não têm corpo lido nem conteúdo guardado; seus IDs já estavam no inbox de sincronização. Há contadores agregados e reavaliação explícita de até 12 descartes por solicitação (últimos 30 dias).

## Limitações críticas

1. **O filtro não restringe os escopos OAuth.** `gmail.readonly` continua sendo um escopo restrito; a aplicação poderia tecnicamente ler outras mensagens, mas este pipeline só busca o corpo das selecionadas. É necessária auditoria independente antes de publicação ampla.
2. A triagem usa **cabeçalhos fornecidos pela API** e palavras explícitas no assunto, não autentica autores nem verifica DKIM/DMARC. `From` pode ser falsificado. Não significa que remetentes permitidos sejam confiáveis para alterações automáticas.
3. **Falsos negativos são possíveis.** Ex.: professor externo escrevendo “Importante” pode ficar fora do escopo até o usuário incluir seu e-mail/domínio. A interface mostra contagem dos descartes e permite reavaliar manualmente; não há detecção infalível de relevância sem ler corpo.
4. Opção “assuntos sensíveis desativados” aplica uma política de **metadados**; um assunto genérico pode conter dados sensíveis no corpo. Não prometer que a categoria está totalmente isolada por simples regex. Para privacidade estrita, conecte caixa separada/consulte fontes explicitamente permitidas.
5. Configurações novas não reprocessam todos os e-mails já concluídos. A reavaliação voluntária cobre até 12 IDs por clique dentro de 30 dias, respeitando orçamento de sincronização. Não modifica eventos sem confirmação.
6. Em mensagens relevantes, há uma **segunda chamada** para recuperar o corpo, podendo aumentar tráfego, latência e consumo de cota. O experimento `npm run bench:monitoring` informa o ponto de equilíbrio para o Gmail; no Graph o ganho de latência/API não foi demonstrado.
7. Perfis pessoais não autorizam pagar contas, enviar e-mails, operar bancos, executar anexos ou alterar dados externos além de lembretes aprovados.

## Configuração e uso

Em **Conexões → Quais e-mails o Aurora pode analisar?**, escolha um perfil por conta e edite as quatro listas de fontes. Use endereços completos ou domínios **sem `@`**. Ao ativar modo pessoal/categorias sensíveis, uma confirmação aparece. Salve e observe os contadores; use “Reavaliar” para revisar IDs descartados, com custo adicional de API. É permitido manter uma conta institucional em modo acadêmico e uma conta pessoal em modo pessoal, de forma independente.

## Arquivos

- `src/domain/monitoring.ts`: política pura de metadados, validação, persistência e classificação condicionada.
- `src/providers/gmail.ts`, `outlook.ts`: envelope antes de corpo.
- `src/app/pipeline.ts`: triagem dentro da sincronização, preservando checkpoint.
- `migrations/0016_monitoring_profiles.sql`: tabelas de regras, contagem e IDs filtrados.
- `src/web/handler.ts`, `ui.html`, `client.js`: API e interface.
- `tests/monitoring.test.mjs`: provas sintéticas e simulações de adaptadores.
