-- Per-connection scopes; no hidden widening to personal messages.
CREATE TABLE IF NOT EXISTS connection_monitoring (
 connection_id TEXT PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
 mode TEXT NOT NULL DEFAULT 'academic_strict' CHECK(mode IN ('academic_strict','academic_extended','personal')),
 allowed_senders TEXT NOT NULL DEFAULT '[]',
 allowed_domains TEXT NOT NULL DEFAULT '[]',
 blocked_senders TEXT NOT NULL DEFAULT '[]',
 blocked_domains TEXT NOT NULL DEFAULT '[]',
 sensitive_opt_in INTEGER NOT NULL DEFAULT 0 CHECK(sensitive_opt_in IN (0,1)),
 updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS monitoring_daily (
 connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
 day TEXT NOT NULL,reason TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(connection_id,day,reason)
);
CREATE INDEX IF NOT EXISTS idx_monitoring_daily_day ON monitoring_daily(day);

CREATE TABLE IF NOT EXISTS monitoring_skips (
 inbox_id INTEGER PRIMARY KEY REFERENCES inbox(id) ON DELETE CASCADE,
 connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
 reason TEXT NOT NULL,
 at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitoring_skips_account ON monitoring_skips(connection_id,at);
CREATE TRIGGER IF NOT EXISTS trg_monitoring_skips_count AFTER INSERT ON monitoring_skips BEGIN
 INSERT INTO monitoring_daily(connection_id,day,reason,count)
 VALUES(NEW.connection_id,strftime('%Y-%m-%d',NEW.at / 1000, 'unixepoch'),NEW.reason,1)
 ON CONFLICT(connection_id,day,reason) DO UPDATE SET count=count+1;
END;
