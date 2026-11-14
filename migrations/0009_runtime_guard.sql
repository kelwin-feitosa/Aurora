CREATE TABLE IF NOT EXISTS runtime_state (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_inbox_conn_retry ON inbox(connection_id,state,next_attempt_at,id);
