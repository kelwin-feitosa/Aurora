# Privacidade, dados e retenção — Aurora 1.6

O Aurora é um assistente acadêmico pessoal que não usa IA paga nem telemetria central por padrão. Os e-mails e convites são **entradas não confiáveis**. O sistema não solicita a senha do Gmail/Outlook: integração real depende de consentimento OAuth legítimo.

**Dados tratados:** identificadores de e-mail, cursores, conta conectada (`account_hint`), tokens OAuth AES-GCM com contexto, registros de decisão, título/data de eventos e tarefas, histórico de sincronização, estados de sessão, outbox e auditoria. Corpo integral do e-mail não é armazenado; a versão 1.6 persiste `source_excerpt=''` para novos itens e a migração `0010` limpa excertos históricos. **A limpeza histórica é irreversível** e deve ser precedida de cópia cifrada conforme política do titular.

**Exportação:** a interface usa páginas de 100 registros e gera JSON sem tokens. O arquivo exportado é sensível porque expõe compromissos e metadados; nunca o anexe publicamente. A exportação **não** substitui backup integral de banco, segredos ou credenciais.

**Retenção:** sessões expiradas, pedidos OAuth antigos, tentativas de login e parte do histórico operacional são eliminados por manutenção diária com cortes de prazo (auditoria 180 dias, cotas 90 dias). Registros de inbox/outbox e compromissos podem persistir para deduplicação e reconciliação; revise sua política de retenção e direitos LGPD antes de oferecer o sistema a terceiros. Desconectar a instância não revoga necessariamente concessão no provedor; faça a revogação no Google/Microsoft quando desejado.

**Backup:** banco cifrado tem material sensível e exige senha pessoal forte, armazenamento separado e autorização do titular. Export D1 remoto usa SQL claro transitório em diretório privado, depois remove; sem teste cloud real. Sem dados reais no pacote distribuível.

**Limites legais:** avaliar LGPD, identificação do controlador quando aplicável, transparência, exclusão, incidentes e transferência internacional antes da distribuição ampla. Instância pessoal não significa imunidade legal.
