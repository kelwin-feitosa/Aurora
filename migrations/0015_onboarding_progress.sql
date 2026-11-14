-- Only a conscious choice to skip optional notifications is persisted.
-- All mandatory onboarding readiness is probed, not claimed via an unchecked checkbox.
CREATE TABLE IF NOT EXISTS onboarding_progress (
 id INTEGER PRIMARY KEY CHECK(id=1),
 notifications_skipped INTEGER NOT NULL DEFAULT 0 CHECK(notifications_skipped IN (0,1)),
 updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO onboarding_progress(id) VALUES(1);
