-- Aurora 1.2: server-side revocation and OAuth request-to-session binding.
CREATE TABLE IF NOT EXISTS sessions (
 id_hash TEXT PRIMARY KEY,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER,
 last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
ALTER TABLE oauth_pending ADD COLUMN session_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_oauth_session ON oauth_pending(session_hash);
