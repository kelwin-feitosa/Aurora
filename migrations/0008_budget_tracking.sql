-- Capture attempts, including API errors; these are application guardrails, not Cloudflare billable metrics.
ALTER TABLE usage_daily ADD COLUMN provider_calls INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_connections_fairness ON connections(enabled,last_sync_at,created_at);
