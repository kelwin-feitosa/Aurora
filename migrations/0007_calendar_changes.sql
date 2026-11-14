-- Non-destructive migration: manual corrections/cancellations are journaled independently of create.
CREATE TABLE IF NOT EXISTS calendar_changes (
 id TEXT PRIMARY KEY,
 item_id TEXT NOT NULL REFERENCES academic_items(id) ON DELETE CASCADE,
 connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
 action TEXT NOT NULL CHECK(action IN ('update','cancel')),
 state TEXT NOT NULL CHECK(state IN ('planned','in_flight','unknown','retryable','committed','blocked')),
 expected_remote_id TEXT NOT NULL,
 desired_start_at TEXT,
 desired_due_date TEXT,
 desired_title TEXT,
 attempt_count INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL DEFAULT 0,
 locked_until INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calendar_changes_work ON calendar_changes(state,next_attempt_at,locked_until);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_changes_active ON calendar_changes(item_id) WHERE state!='committed';
