-- Additive migration for existing deployments - safe to run any time,
-- indexes don't touch existing data.
--
--   wrangler d1 execute portfolio_db --local  --file=./d1-migration-004-indexes.sql
--   wrangler d1 execute portfolio_db --remote --file=./d1-migration-004-indexes.sql
--
-- Every query these power already runs today - this just makes them use an
-- index scan instead of a full table scan. pageviews and contact_messages
-- grow on every visit/submission (not just content you create yourself),
-- so these matter more over time than the current data volume suggests.

CREATE INDEX IF NOT EXISTS idx_contact_messages_ip_hash_created ON contact_messages (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pageviews_created ON pageviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_published_sort ON projects (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_now_items_published_sort ON now_items (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_resume_sections_hidden_sort ON resume_sections (hidden, sort_order);
CREATE INDEX IF NOT EXISTS idx_resume_entries_section ON resume_entries (section_id);
CREATE INDEX IF NOT EXISTS idx_resume_entries_hidden_sort ON resume_entries (hidden, sort_order);
CREATE INDEX IF NOT EXISTS idx_faq_items_published_sort ON faq_items (published, sort_order);
