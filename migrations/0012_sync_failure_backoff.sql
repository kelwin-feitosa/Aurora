-- Avoid starvation: an unavailable mailbox must not occupy every cron tick.
ALTER TABLE connections ADD COLUMN next_sync_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_connections_next_sync ON connections(enabled,next_sync_at,last_sync_at);
