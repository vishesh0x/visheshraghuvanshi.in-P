-- Cloudflare D1 (SQLite) Schema for Portfolio OS
--
-- !! DESTRUCTIVE !! This file DROPS every table below (admin accounts, contact
-- messages, analytics, media records, content) before recreating them. Use it
-- only for a brand-new database. For an existing database run the additive
-- d1-migration-*.sql files instead.

DROP TABLE IF EXISTS site_config;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS now_items;
DROP TABLE IF EXISTS resume_entries;
DROP TABLE IF EXISTS resume_sections;
DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS pageviews;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS login_attempts;

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

-- ============ legal_pages ============
CREATE TABLE legal_pages (
  page_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT ''
);

INSERT INTO legal_pages (page_key, title, body_html) VALUES
  ('privacy', 'Privacy policy', '<h2>Who this covers</h2>
<p>This policy applies to this site. It explains what gets collected when you visit or use the contact form, and what does not.</p>
<h2>What is collected</h2>
<p>Page visits are logged in a first-party, privacy-first way: the path you viewed, the referring page, and a coarse country code derived from your network. No cookies are set for this. Instead of storing your raw IP address, it is combined with your browser''s user agent and the current date, then one-way hashed (SHA-256) before it is stored - the result cannot be reversed back into your IP address, and it changes every day.</p>
<p>If you use the contact form, the name, email address, subject and message you submit are stored so a reply can be sent. The same hashed, non-reversible identifier and coarse country code described above are stored alongside the message to help filter spam. If Cloudflare Turnstile bot verification is enabled on this deployment, submitting the form also involves a request to Cloudflare''s Turnstile service, which is subject to Cloudflare''s own privacy policy.</p>
<h2>What is not collected</h2>
<ul>
<li>No advertising or third-party tracking cookies</li>
<li>No cross-site tracking pixels</li>
<li>No sale or sharing of data with advertisers</li>
<li>No raw IP addresses retained in analytics records</li>
</ul>
<h2>How data is used</h2>
<p>Pageview data is used only to understand which pages are read and roughly how much traffic the site gets. Contact form submissions are used only to respond to your message. Analytics are visible only to the site owner through a password-protected dashboard.</p>
<h2>Third parties</h2>
<p>This site is served from Cloudflare''s network and may use Cloudflare Turnstile for bot protection on the contact form. Fonts are loaded from Google Fonts, which may log standard request data (such as IP address) as part of serving the font files. No other third-party analytics, advertising, or tracking scripts are used.</p>
<h2>Data retention</h2>
<p>Pageview records and contact messages are kept only as long as needed for the purposes above and are deleted on request (see Contact, below).</p>
<h2>Your choices</h2>
<p>Because no tracking cookies are used, there is nothing to opt out of in your browser. You can still choose not to submit the contact form, and you can ask for any contact messages you have sent to be deleted.</p>
<h2>Contact</h2>
<p>Questions about this policy, or requests to access or delete data associated with a contact form submission, can be sent through the Contact page.</p>
<h2>Changes</h2>
<p>This policy may be updated as the site changes.</p>'),
  ('terms', 'Terms of use', '<h2>Acceptance</h2>
<p>By browsing this site or submitting the contact form, you agree to these terms. If you do not agree, please discontinue use of the site.</p>
<h2>Content ownership</h2>
<p>Unless otherwise noted, the text, project write-ups, images and code samples on this site belong to the site owner. You may read, link to, and quote short excerpts with attribution and a link back to the original page. Reproducing whole articles, project case studies, or images without permission is not allowed.</p>
<h2>Acceptable use</h2>
<p>You agree not to use this site to:</p>
<ul>
<li>Attempt to gain unauthorized access to the admin dashboard or underlying systems</li>
<li>Submit the contact form for spam, phishing, or automated bulk messaging</li>
<li>Scrape or republish content at scale without permission</li>
<li>Interfere with the normal operation of the site</li>
</ul>
<h2>No professional advice</h2>
<p>Project write-ups, resume content and "now" updates are shared for informational purposes only and do not constitute professional, legal, or financial advice.</p>
<h2>Third-party links</h2>
<p>This site links to external sites (live project demos, source repositories, social profiles). Those sites are not controlled by the site owner, and their content and policies are their own responsibility.</p>
<h2>Availability</h2>
<p>The site is provided "as is" without warranties of any kind. Features, content, and availability may change or be discontinued at any time without notice.</p>
<h2>Limitation of liability</h2>
<p>To the fullest extent permitted by law, the site owner is not liable for any indirect, incidental, or consequential damages arising from your use of this site.</p>
<h2>Changes to these terms</h2>
<p>These terms may be updated from time to time. Continued use of the site after a change constitutes acceptance of the revised terms.</p>
<h2>Contact</h2>
<p>Questions about these terms can be sent through the Contact page.</p>');

-- ============ faq_items ============
CREATE TABLE faq_items (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO faq_items (id, question, answer, sort_order) VALUES
  ('faq-1', 'What do you work on?', 'Systems, tools and interfaces - see the Projects page for shipped case studies with the stack and outcomes for each one.', 0),
  ('faq-2', 'Are you available for freelance or full-time work?', 'Current availability is shown at the top of the home page. If it says available, reach out through the Contact page and include a short brief.', 1),
  ('faq-3', 'How do I get in touch?', 'The fastest way is the Contact page. Messages land directly in the site owner''s inbox - no third-party form service, no tracking pixels.', 2),
  ('faq-4', 'How quickly do you reply?', 'Most messages get a reply within a couple of business days. If something is time-sensitive, say so in the subject line.', 3),
  ('faq-5', 'Do you track visitors with cookies?', 'No. Pageviews are logged with a privacy-first, cookie-free beacon - see the Privacy policy for exactly what is and isn''t stored.', 4),
  ('faq-6', 'Can I reuse your project write-ups or code samples?', 'Short excerpts with attribution and a link back are welcome. For anything more, ask first. Details are in the Terms of use page.', 5),
  ('faq-7', 'Is the resume on this site up to date?', 'Yes - it''s rendered live from the same content that powers the downloadable PDF, so it reflects the latest version rather than a stale export.', 6),
  ('faq-8', 'What is the ''Now'' board?', 'A running log of what currently has attention - building, reading, learning, listening, shipping - updated by hand rather than automated from another feed.', 7);

-- ============ now_items ============
CREATE TABLE now_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'BUILDING',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  link_url TEXT,
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

-- ============ login_attempts ============
-- Used to throttle brute-force sign-in attempts (see signInAdminActionImpl).
CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_login_attempts_email_time ON login_attempts (email, created_at);

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

-- ============ indexes ============
-- Every query below already runs today - these just make them use an index
-- scan instead of a full table scan. Cheap at this app's current scale,
-- but free to add now and only gets more valuable as tables grow (pageviews
-- and contact_messages in particular grow on every visit/submission, not
-- just on content you create yourself).

-- Powers the rate limiter (checkRateLimit) - runs on every single contact
-- form submission, filtering by ip_hash and a created_at cutoff.
CREATE INDEX idx_contact_messages_ip_hash_created ON contact_messages (ip_hash, created_at);
CREATE INDEX idx_contact_messages_created ON contact_messages (created_at DESC);

-- Powers admin.analytics.tsx's date-range summary and raw event list.
CREATE INDEX idx_pageviews_created ON pageviews (created_at DESC);

-- Powers the public projects list (WHERE published = 1 ORDER BY sort_order).
CREATE INDEX idx_projects_published_sort ON projects (published, sort_order);

-- Powers the public Now board (WHERE published = 1 ORDER BY sort_order).
CREATE INDEX idx_now_items_published_sort ON now_items (published, sort_order);

-- Powers the public resume (WHERE hidden = 0 ORDER BY sort_order), and
-- resolving a section's entries.
CREATE INDEX idx_resume_sections_hidden_sort ON resume_sections (hidden, sort_order);
CREATE INDEX idx_resume_entries_section ON resume_entries (section_id);
CREATE INDEX idx_resume_entries_hidden_sort ON resume_entries (hidden, sort_order);

-- Powers the public FAQ list (WHERE published = 1 ORDER BY sort_order).
CREATE INDEX idx_faq_items_published_sort ON faq_items (published, sort_order);

