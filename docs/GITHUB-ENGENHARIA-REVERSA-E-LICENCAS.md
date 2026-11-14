# Aurora 2.4 — referências open source, licenças e investigação lícita

A investigação foi leitura pública de documentação, descrições, fluxos e contratos; **não houve cópia de código de terceiros, execução de binário fechado, bypass de mecanismos de proteção ou alegação de benchmark dos projetos externos**.

| Repositório / licença observada | Potencial para Aurora | Decisão / evidência ausente |
|---|---|---|
| postalsys/postal-mime — MIT No Attribution | MIME robusto no browser/serverless; https://github.com/postalsys/postal-mime | Não incorporar ainda; nosso fluxo recebe JSON do Gmail/Graph e há teto CPU Workers Free. Só vale após corpus MIME e medição de bundle/CPU com ganhos demonstrados. |
| kewisch/ical.js — MPL 2.0 | Parser iCalendar rico, recorrências/zonas; https://github.com/kewisch/ical.js | Não incorporar na RC: alteração de parser e obrigações MPL sem prova de necessidade/benefício no subset suportado. Revisitar quando houver corpus ICS representativo. |
| wanasit/chrono — verificar licença na revisão de adoção | Datas em linguagem natural, suporte parcial ao português; https://github.com/wanasit/chrono | Não incorporar: infere datas relativas que poderiam criar eventos incorretos; requer avaliação adversarial PT-BR e política de abstenção. |
| OWASP/ASVS — CC BY-SA 4.0, padrão técnico | Guia de auditoria de web apps; https://github.com/OWASP/ASVS | Adotado como referência de controles, sem copiar texto/código e sem afirmar certificação. |

## Engenharia reversa e testes de compatibilidade permitidos
Foram comparados contratos documentados Gmail messages.get (metadata/full), Microsoft Graph message delta ($select e token opaco), eventos e o código dos nossos adaptadores. É uma análise de interoperabilidade, não ataque aos serviços. Não se experimentou com contas ou tráfego de terceiros; sem tokens reais e sem consentimento não são feitos testes ativos.

## Trade-offs
Bibliotecas de parsing extensas aumentam bundle, dependências, consumo de CPU e superfície de ataque. Sem medir melhora significativa de recall/correção versus baseline, o custo de manutenção supera a hipótese de benefício. Seleção feita por requisitos e métricas; popularidade e estrelas do GitHub não foram usadas como critério.
