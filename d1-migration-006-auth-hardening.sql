-- Additive migration for auth hardening. Safe to run on a live database.
--
--   wrangler d1 execute portfolio_db --remote --file=./d1-migration-006-auth-hardening.sql
--
-- 1. admin_users.session_version: sign-out bumps it, which instantly revokes
--    every previously issued session cookie (they were valid for 7 days).
-- 2. login_attempts.ip_hash: lets the throttle work per IP as well as per
--    email, so a stranger hammering the login form can no longer lock the real
--    owner out. Stored as a keyed hash, never the raw address.
--
-- "duplicate column name" means it was already applied and is safe to ignore.

ALTER TABLE admin_users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE login_attempts ADD COLUMN ip_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts (ip_hash, created_at);
