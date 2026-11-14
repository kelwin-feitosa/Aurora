-- Opt-in Web Push device endpoints are encrypted; no academic content in payloads.
CREATE TABLE IF NOT EXISTS push_subscriptions (
 id TEXT PRIMARY KEY,
 session_hash TEXT NOT NULL,
 endpoint_ciphertext TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','revoked')) DEFAULT 'active',
 consent_at INTEGER NOT NULL,
 last_sent_at INTEGER NOT NULL,
 next_attempt_at INTEGER NOT NULL DEFAULT 0,
 failures INTEGER NOT NULL DEFAULT 0,
 last_status TEXT,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_pending ON push_subscriptions(state,next_attempt_at,last_sent_at);
CREATE INDEX IF NOT EXISTS idx_push_session ON push_subscriptions(session_hash,state);
CREATE TABLE IF NOT EXISTS push_preferences (
 id INTEGER PRIMARY KEY CHECK(id=1),
 quiet_start TEXT NOT NULL DEFAULT '22:00',
 quiet_end TEXT NOT NULL DEFAULT '07:00',
 quiet_zone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
 updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO push_preferences(id) VALUES(1);
