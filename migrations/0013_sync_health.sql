-- Mailbox health metrics: no secrets or email body stored.
ALTER TABLE connections ADD COLUMN last_attempt_at INTEGER;
ALTER TABLE connections ADD COLUMN last_success_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_connections_sync_due_22 ON connections(enabled,next_sync_at,last_sync_at);
