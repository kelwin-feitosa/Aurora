ALTER TABLE academic_items ADD COLUMN fingerprint TEXT;
CREATE INDEX IF NOT EXISTS idx_items_fingerprint ON academic_items(connection_id,fingerprint);
