# Pesquisa científica aplicada à triagem Aurora 2.4

## Questão e hipótese
Como extrair datas e tarefas de avisos em português e reduzir corpo baixado sem elevar falsos negativos, ações incorretas ou CPU? Hipótese falsificável: filtragem por metadados aumenta privacidade mas prejudica recall quando assuntos são genéricos; a decisão pode ser reversa segundo o corpus.

## Bibliografia localizada e implicação
1. **Strötgen & Gertz (2010), HeidelTime: High Quality Rule-Based Extraction and Normalization of Temporal Expressions**, ACL SemEval. https://aclanthology.org/S10-1071/ . Método baseado em regras, identificação versus normalização temporal. Implicação: separar reconhecimento e interpretação; não assumir que uma regex para datas resolve o contexto temporal.
2. **Strötgen & Gertz (2013), Multilingual and cross-domain temporal tagging**, Language Resources and Evaluation, DOI 10.1007/s10579-012-9179-y. https://doi.org/10.1007/s10579-012-9179-y . Implicação: domínio e idioma afetam validação. Não extrapolar resultados de notícias para mensagens acadêmicas.
3. **Costa & Branco (2012), TimeBankPT: A TimeML Annotated Corpus of Portuguese**, LREC. https://aclanthology.org/L12-1096/ . Exemplo de corpus de português com relações entre eventos e expressões de tempo. É referência metodológica, não benchmark executado ou dataset de e-mails da UDF/CEUB.
4. **OWASP Prompt Injection Prevention**, https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html . E-mails são entrada não confiável; uso de IA sem limitação de ações aumentaria risco. O Aurora 2.4 manteve regra determinística e confirmação humana em casos incertos.

## Protocolo de validação futura
Obter consentimento específico e amostra anonimizada/rotulada, inclusive assuntos genéricos, disciplinas, comunicados com datas conflitantes, cancelamentos, convites ICS e avisos financeiros. Separar treino e teste por fonte/remetente para evitar vazamento. Medir precisão, recall, F1, taxa de abstenção, falso evento criado, tempo CPU e custos por 100 mensagens; reportar intervalos de confiança quando n justificar. Comparar baseline full, triagem metadata+full e revisões aprovadas, em **mesmo corpus e mesmo ambiente**. Contar data correta e tipo de ação correto separadamente.

## Resultado aplicável na 2.4
Foi criado o benchmark sintético reprodutível de 48 cenários com uma variável controlada de assunto genérico; em 100 mensagens com 25 mensagens relevantes e seis de assunto genérico, a triagem perde seis relevantes antes de leitura integral. Isto é uma advertência mensurável sobre o **dataset artificial**, não estimativa de recall de estudantes. Não se justifica incorporar ML/LLM ou grandes bibliotecas antes de dados rotulados e CPU real.
