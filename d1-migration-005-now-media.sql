-- Additive migration: lets Now-board items keep the image and link the admin
-- form already collects. Before this, both fields were accepted by the form
-- and silently discarded on save.
--
--   wrangler d1 execute portfolio_db --local  --file=./d1-migration-005-now-media.sql
--   wrangler d1 execute portfolio_db --remote --file=./d1-migration-005-now-media.sql
--
-- SQLite has no "ADD COLUMN IF NOT EXISTS": if you see "duplicate column name"
-- the migration was already applied and it is safe to ignore.

ALTER TABLE now_items ADD COLUMN image_url TEXT;
ALTER TABLE now_items ADD COLUMN link_url TEXT;
