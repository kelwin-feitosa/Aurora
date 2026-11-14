PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS connections (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider IN ('gmail','outlook')),
 account_hint TEXT NOT NULL, token_ciphertext TEXT NOT NULL,
 calendar_id TEXT, sync_cursor TEXT, sync_page TEXT, sync_anchor TEXT,
 sync_mode TEXT NOT NULL DEFAULT 'bootstrap',
 last_sync_at INTEGER, last_error TEXT, enabled INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_connections_active ON connections(enabled,provider);
CREATE TABLE IF NOT EXISTS oauth_pending (
 state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL,
 verifier_ciphertext TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_oauth_expiry ON oauth_pending(expires_at);
CREATE TABLE IF NOT EXISTS inbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT, connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
 remote_id TEXT NOT NULL, remote_revision TEXT NOT NULL DEFAULT '0',
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','done','retry')),
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0,
 last_error TEXT, received_at INTEGER NOT NULL,
 UNIQUE(connection_id, remote_id,remote_revision)
);
CREATE INDEX IF NOT EXISTS idx_inbox_pending ON inbox(state,next_attempt_at,id);
CREATE TABLE IF NOT EXISTS academic_items (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
 inbox_id INTEGER NOT NULL REFERENCES inbox(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('event','task','notice','review')),
 title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', start_at TEXT, due_date TEXT,
 time_zone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
 confidence TEXT NOT NULL CHECK(confidence IN ('explicit','incomplete','ambiguous')),
 source_excerpt TEXT NOT NULL DEFAULT '', rationale TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL CHECK(state IN ('review','approved','notice','ignored','synced')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(inbox_id)
);
CREATE INDEX IF NOT EXISTS idx_items_upcoming ON academic_items(state,start_at,due_date);
CREATE TABLE IF NOT EXISTS outbox (
 id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES academic_items(id) ON DELETE CASCADE,
 connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
 action TEXT NOT NULL CHECK(action IN ('create')),
 state TEXT NOT NULL CHECK(state IN ('planned','in_flight','unknown','retryable','committed','blocked')),
 attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0,
 remote_event_id TEXT, last_error TEXT, locked_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(item_id,action)
);
CREATE INDEX IF NOT EXISTS idx_outbox_work ON outbox(state,next_attempt_at,locked_until);
CREATE TABLE IF NOT EXISTS usage_daily (
 date_key TEXT PRIMARY KEY, mail_reads INTEGER NOT NULL DEFAULT 0,
 calendar_writes INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
 action TEXT NOT NULL, detail_code TEXT NOT NULL
);
