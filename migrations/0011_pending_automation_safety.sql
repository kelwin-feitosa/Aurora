-- 2.0 security migration: unsent, automatically approved items from an older
-- installation must not bypass the new default human-review policy.
-- Never touch committed, unknown or in-flight operations, nor human approvals.
UPDATE academic_items SET state='review',confidence='ambiguous',
 rationale='Atualização de segurança: confirme este compromisso antes do envio automático'
WHERE state='approved' AND rationale!='Confirmado manualmente pelo titular'
 AND EXISTS(SELECT 1 FROM outbox o WHERE o.item_id=academic_items.id
            AND o.state IN ('planned','retryable'));
DELETE FROM outbox WHERE state IN ('planned','retryable') AND
 item_id IN (SELECT id FROM academic_items
             WHERE state='review'
              AND rationale='Atualização de segurança: confirme este compromisso antes do envio automático');
