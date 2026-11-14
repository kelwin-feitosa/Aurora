-- 1.6: historical message excerpts were never required for the user interface.
-- Explicit privacy migration removes those fragments while retaining metadata and audit codes.
UPDATE academic_items SET source_excerpt='' WHERE source_excerpt!='';
CREATE INDEX IF NOT EXISTS idx_items_export_keyset ON academic_items(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_retention ON audit(at);
