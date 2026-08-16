If you are setting up a new database deployment, your single file would simply be the complete schema provided in your third snippet.

The first and second snippets are "additive migrations" designed specifically for updating existing databases without dropping data. The main schema script already incorporates all the new columns (such as `site_title` and `meta_title`) and new tables (like `page_meta`) introduced in those migrations.

Here is the unified database file you need:

```sql
-- Cloudflare D1 (SQLite) Schema for Portfolio OS

DROP TABLE IF EXISTS site_config;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS now_items;
DROP TABLE IF EXISTS resume_entries;
DROP TABLE IF EXISTS resume_sections;
DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS pageviews;
DROP TABLE IF EXISTS admin_users;

-- ============ site_config ============
CREATE TABLE site_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  owner_name TEXT NOT NULL DEFAULT 'Your Name',
  initials TEXT NOT NULL DEFAULT 'Y',
  system_name TEXT NOT NULL DEFAULT 'YOUR_NAME.SYS',
  hero_line_one TEXT NOT NULL DEFAULT 'ENGINEERING',
  hero_line_two TEXT NOT NULL DEFAULT 'DIGITAL ARCHITECTURES.',
  bio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Available',
  location TEXT NOT NULL DEFAULT 'Remote',
  contact_email TEXT NOT NULL DEFAULT 'hello@example.com',
  resume_pdf_url TEXT,
  build_version TEXT NOT NULL DEFAULT '1.0.0-RELEASE',
  socials_json TEXT NOT NULL DEFAULT '[]',
  meta_description TEXT NOT NULL DEFAULT '',
  site_title TEXT NOT NULL DEFAULT 'Portfolio OS',
  favicon_url TEXT,
  now_categories_json TEXT NOT NULL DEFAULT '["BUILDING","READING","LEARNING","LISTENING","SHIPPING","AVAILABILITY"]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ projects ============
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  live_url TEXT,
  source_url TEXT,
  year INTEGER NOT NULL DEFAULT (CAST(strftime('%Y', 'now') AS INTEGER)),
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ page_meta ============
-- Editable <title>/<meta description> for every static route. Individual
-- project pages use projects.meta_title / projects.meta_description instead
-- (falling back to the project's own title/summary), since there can be many.
CREATE TABLE page_meta (
  page_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO page_meta (page_key, title, description) VALUES
  ('home', 'Portfolio OS - Engineering index & live work log', 'Portfolio, projects, resume and current work of an independent systems-minded developer.'),
  ('projects', 'Projects - Portfolio OS', 'Case studies and shipped work - systems, tools and interfaces.'),
  ('resume', 'Resume - experience, systems and credentials', 'Experience, skills, and credentials.'),
  ('now', 'Now - current focus, reading and builds', 'What I am building, reading, and shipping right now.'),
  ('contact', 'Contact - open a direct channel', 'Get in touch directly - email or socials.');

-- ============ now_items ============
CREATE TABLE now_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'BUILDING',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ resume_sections ============
CREATE TABLE resume_sections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ resume_entries ============
CREATE TABLE resume_entries (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES resume_sections(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  bullets_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ media_assets ============
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ contact_messages ============
CREATE TABLE contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0,
  country TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ pageviews ============
CREATE TABLE pageviews (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  visitor_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ admin_users ============
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ Seed Initial Data ============
INSERT INTO site_config (id, owner_name, initials, system_name, hero_line_one, hero_line_two, bio, status, location, contact_email, build_version, socials_json, meta_description, site_title, now_categories_json)
VALUES (
  'default', 'Your Name', 'Y', 'YOUR_NAME.SYS', 'ENGINEERING', 'DIGITAL ARCHITECTURES.',
  'Independent developer specializing in low-latency systems and aesthetic interfaces. Currently building edge-native content engines and design systems that outlive their frameworks.',
  'Available for Q3', 'Remote / Worldwide', 'hello@example.com', '1.0.0-RELEASE',
  '[{"label":"Github","url":"https://github.com"},{"label":"LinkedIn","url":"https://linkedin.com"},{"label":"Read.cv","url":"https://read.cv"}]',
  'Portfolio, projects, resume and current work of an independent systems-minded developer.',
  'YOUR_NAME.SYS - Portfolio OS',
  '["BUILDING","READING","LEARNING","LISTENING","SHIPPING","AVAILABILITY"]'
);

INSERT INTO projects (id, slug, title, summary, body, cover_url, tags_json, live_url, source_url, year, featured, sort_order) VALUES
('proj-1', 'synapse-engine', 'Synapse Engine', 'Custom CMS core with real-time markdown synchronization and asset versioning.',
'<p>Synapse Engine is a content core built for teams that treat writing as production infrastructure. Every document is a versioned object; every asset is content-addressed.</p><h3>Highlights</h3><ul><li>Conflict-free real-time editing across sessions</li><li>Content-addressed asset pipeline with automatic derivatives</li><li>Sub-50ms reads from the edge cache layer</li></ul><p>The hardest problem was not synchronization but invalidation: knowing precisely which rendered surfaces a single field change affects.</p>',
'/covers/synapse-engine.jpg', '["RUST","WASM","EDGE"]', 'https://example.com', 'https://github.com', 2023, 1, 1),
('proj-2', 'oculus-visuals', 'Oculus Visuals', 'Photographer portfolio platform optimized for LCP and sub-100ms transitions.',
'<p>Oculus Visuals is a publishing platform for photographers who care about how their work loads, not just how it looks.</p><h3>Highlights</h3><ul><li>Progressive image ladders generated at upload time</li><li>View transitions with zero layout shift</li><li>Median LCP of 780ms on 4G</li></ul>',
'/covers/oculus-visuals.jpg', '["TS","WEBGL","IMAGES"]', 'https://example.com', 'https://github.com', 2024, 1, 2),
('proj-3', 'flux-analytics', 'Flux Analytics', 'Privacy-first visitor tracking for independent creators and small studios.',
'<p>Flux Analytics answers the three questions that actually matter - what got read, who sent them, and where they were - without cookies, fingerprints, or consent banners.</p><h3>Highlights</h3><ul><li>Daily rotating hashed visitor keys, no persistent identifiers</li><li>Edge-header geography, no IP storage</li><li>Single-table schema that stays fast past ten million rows</li></ul>',
'/covers/flux-analytics.jpg', '["GO","SQLITE","PRIVACY"]', 'https://example.com', 'https://github.com', 2024, 1, 3);

INSERT INTO now_items (id, title, description, category, sort_order) VALUES
('now-1', 'Building the edge content core', 'Rewriting the render pipeline so a content change propagates globally in under a second.', 'BUILDING', 1),
('now-2', 'Reading: Designing Data-Intensive Applications', 'Third pass, this time taking the consensus chapters seriously.', 'READING', 2),
('now-3', 'Learning Rust for WASM targets', 'Porting the hot path of the markdown parser to WebAssembly.', 'LEARNING', 3),
('now-4', 'Open to selected contract work', 'Two days a week, systems and interface architecture.', 'AVAILABILITY', 4);

INSERT INTO resume_sections (id, title, sort_order) VALUES
('sec-1', 'Work Experience', 1),
('sec-2', 'Side Projects', 2),
('sec-3', 'Certifications', 3);

INSERT INTO resume_entries (id, section_id, role, organization, start_date, end_date, location, description, bullets_json, sort_order) VALUES
('ent-1', 'sec-1', 'Principal Engineer', 'Vortex Labs', '2022', 'Present', 'Remote', 'Leading the platform group building distributed content infrastructure.', '["Cut global p95 read latency from 340ms to 44ms","Designed the multi-tenant asset pipeline serving 2.1PB/month","Grew the platform team from 3 to 11 engineers"]', 1),
('ent-2', 'sec-1', 'Senior Frontend Engineer', 'Northlight', '2019', '2022', 'Berlin, DE', 'Owned the design system and the public-facing web surface.', '["Shipped a token-driven design system adopted by 6 product teams","Reduced bundle size 61% through route-level code splitting"]', 2),
('ent-3', 'sec-2', 'Maintainer', 'Open Source Toolchain', '2020', 'Present', 'Remote', 'Maintaining a small set of build and content tools.', '["4.2k stars across three repositories","Monthly release cadence for six consecutive years"]', 1),
('ent-4', 'sec-3', 'Cloud Solutions Architect', 'Professional Certification', '2023', '2023', '', 'Architecture, networking and edge delivery.', '[]', 1);

INSERT INTO contact_messages (id, name, email, subject, message, is_read, is_starred, country, created_at) VALUES
('msg-1', 'Sarah Jenkins', 'sarah@studionorth.co', 'Potential collaboration', 'We are scoping a design system rebuild for Q4 and would like to talk about architecture support. Two-month engagement, remote.', 0, 1, 'GB', datetime('now', '-2 hours')),
('msg-2', 'Marcus Thorne', 'marcus@thorne.dev', 'Question about Synapse Engine', 'How do you handle invalidation when a shared fragment changes across hundreds of documents? Genuinely curious about the fan-out strategy.', 0, 0, 'US', datetime('now', '-1 day')),
('msg-3', 'Ana Ruiz', 'ana@ruiz.design', 'Speaking invitation', 'Would you be open to a 30-minute talk on privacy-first analytics at our March meetup?', 1, 0, 'ES', datetime('now', '-6 days'));

```
