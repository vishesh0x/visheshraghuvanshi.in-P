-- Additive migration for existing deployments.
--
--   wrangler d1 execute portfolio_db --local  --file=./d1-migration-003-legal-faq.sql
--   wrangler d1 execute portfolio_db --remote --file=./d1-migration-003-legal-faq.sql
--
-- Adds: dashboard-editable FAQ items and Privacy/Terms pages, so these no
-- longer require a code change to update. Uses CREATE TABLE IF NOT EXISTS +
-- INSERT OR IGNORE so it's safe to run even if some of this already exists.

-- ============ legal_pages ============
CREATE TABLE IF NOT EXISTS legal_pages (
  page_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO legal_pages (page_key, title, body_html) VALUES
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
CREATE TABLE IF NOT EXISTS faq_items (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO faq_items (id, question, answer, sort_order) VALUES
  ('faq-1', 'What do you work on?', 'Systems, tools and interfaces - see the Projects page for shipped case studies with the stack and outcomes for each one.', 0),
  ('faq-2', 'Are you available for freelance or full-time work?', 'Current availability is shown at the top of the home page. If it says available, reach out through the Contact page and include a short brief.', 1),
  ('faq-3', 'How do I get in touch?', 'The fastest way is the Contact page. Messages land directly in the site owner''s inbox - no third-party form service, no tracking pixels.', 2),
  ('faq-4', 'How quickly do you reply?', 'Most messages get a reply within a couple of business days. If something is time-sensitive, say so in the subject line.', 3),
  ('faq-5', 'Do you track visitors with cookies?', 'No. Pageviews are logged with a privacy-first, cookie-free beacon - see the Privacy policy for exactly what is and isn''t stored.', 4),
  ('faq-6', 'Can I reuse your project write-ups or code samples?', 'Short excerpts with attribution and a link back are welcome. For anything more, ask first. Details are in the Terms of use page.', 5),
  ('faq-7', 'Is the resume on this site up to date?', 'Yes - it''s rendered live from the same content that powers the downloadable PDF, so it reflects the latest version rather than a stale export.', 6),
  ('faq-8', 'What is the ''Now'' board?', 'A running log of what currently has attention - building, reading, learning, listening, shipping - updated by hand rather than automated from another feed.', 7);
