-- Durable one-shot manual review. Existing records are unchanged.
-- Wrangler tracks migration files and applies each migration once.
ALTER TABLE inbox ADD COLUMN force_full_read INTEGER NOT NULL DEFAULT 0 CHECK(force_full_read IN (0,1));
