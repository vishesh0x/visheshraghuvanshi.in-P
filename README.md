# Your Digital Canvas - Portfolio OS

> **A self-hosted, edge-native portfolio & content management system.**  
> Built with TanStack Start, React 19, Tailwind CSS v4, and the Cloudflare edge stack.

---

## What Is This?

**Portfolio OS** is a full-stack personal portfolio platform that you own entirely - no third-party SaaS subscription, no lock-in. It presents your work like a curated operating system: a monochrome, typographic aesthetic with a rich admin control dashboard behind `/admin`.

Everything runs on Cloudflare's global edge network - zero cold-start, zero managed servers.

---

## Features

### Public-Facing Portfolio
| Feature | Description |
|---|---|
| **Hero** | Customisable headline, bio, status badge, and location |
| **Projects** | Published portfolio pieces with rich-text body, tags, cover image, live/source links |
| **Now** | "What I'm working on right now" board - categorised live feed |
| **Resume** | Dynamically assembled résumé with drag-and-drop section/entry management |
| **Contact** | Spam-protected contact form with optional Cloudflare Turnstile CAPTCHA |
| **Social links** | Configurable links in the site header |

### Admin Control Dashboard (`/admin`)
| Section | Capabilities |
|---|---|
| **Overview** | At-a-glance stats: projects, messages, 7-day pageviews, recent inbox |
| **Site Config** | Edit all site identity fields - name, hero, bio, socials, resume PDF URL |
| **Projects** | Full CRUD + drag-to-reorder, rich-text body editor (Tiptap), publish/draft toggle |
| **Now Board** | CRUD + reorder for "Now" items by category |
| **Resume Builder** | Drag-and-drop section/entry reordering, inline editing, hidden toggle |
| **Assets** | Upload media to Cloudflare R2 - images and documents served via `/api/media/*` |
| **Inbox** | Read, star, and delete contact form submissions |
| **Analytics** | Privacy-first pageview analytics: daily chart, top paths, top referrers |

### Infrastructure
- **Privacy-first analytics** - IP addresses are hashed with SHA-256 before storage; no personal data persisted
- **Edge authentication** - Web Crypto HMAC-SHA256 signed session cookies, no JWT library required
- **CSRF protection** - Automatic CSRF middleware via TanStack Start on all server functions
- **Turnstile CAPTCHA** - Optional bot protection on the contact form

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                 Cloudflare Global Network              │
│                                                        │
│  ┌─────────────────┐      ┌──────────────────────┐    │
│  │ Cloudflare Pages│      │  Cloudflare Workers  │    │
│  │  (Static Assets)│◄────►│ (SSR + Server Fns)   │    │
│  └─────────────────┘      └──────────┬───────────┘    │
│                                      │                 │
│                         ┌────────────┼────────────┐   │
│                         ▼            ▼            ▼   │
│                   ┌──────────┐  ┌────────┐  ┌──────┐  │
│                   │   D1     │  │  R2    │  │ KV / │  │
│                   │(SQLite)  │  │(Media) │  │ Env  │  │
│                   └──────────┘  └────────┘  └──────┘  │
└───────────────────────────────────────────────────────┘
```

| Layer | Technology | Role |
|---|---|---|
| **Frontend** | Cloudflare Pages | Hosts static assets and SSR-rendered HTML |
| **Backend** | Cloudflare Workers | Runs TanStack Start server functions and API route handlers |
| **Database** | Cloudflare D1 (SQLite) | All CMS data: projects, resume, analytics, messages |
| **Media Storage** | Cloudflare R2 | Uploaded images and documents served via `/api/media/*` |

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | [TanStack Start](https://tanstack.com/start) (React 19 + Nitro SSR) |
| **Router** | TanStack Router (file-based, type-safe) |
| **Data fetching** | TanStack Query + TanStack Start Server Functions |
| **Styling** | Tailwind CSS v4 (utility-first, no config) |
| **UI components** | Radix UI primitives + shadcn/ui |
| **Rich text editor** | Tiptap v3 |
| **Drag & drop** | @dnd-kit/core + @dnd-kit/sortable |
| **Form validation** | Zod + react-hook-form |
| **Charts** | Recharts |
| **Build tool** | Vite 8 |
| **Runtime** | Cloudflare Workers (V8 isolates, Web Crypto API) |

---

## Repository Structure

```
your-digital-canvas/
├── d1-schema.sql              # Cloudflare D1 SQLite schema + seed data
├── wrangler.json              # Wrangler config: D1 + R2 bindings
├── .env.sample                # Environment variable reference
│
└── src/
    ├── routes/                # TanStack Router file-based routes
    │   ├── __root.tsx         # Root layout (QueryClientProvider, error boundary)
    │   ├── index.tsx          # Public homepage (hero, projects, bio)
    │   ├── projects/          # Project detail pages (/projects/:slug)
    │   ├── now.tsx            # "Now" board public page
    │   ├── resume.tsx         # Public résumé page
    │   ├── contact.tsx        # Contact form page
    │   ├── auth.tsx           # Admin sign-in / sign-up
    │   ├── admin.tsx          # Admin shell layout (auth guard + sidebar)
    │   ├── admin.*.tsx        # Admin sub-pages (site, projects, now, resume...)
    │   └── api/
    │       ├── media.$.ts     # R2 media proxy (GET /api/media/*)
    │       └── public/
    │           └── contact.ts # Contact form POST handler
    │
    ├── lib/
    │   ├── auth/
    │   │   ├── admin-auth.ts        # Isomorphic entry: createServerFn stubs
    │   │   └── admin-auth.server.ts # Server-only: HMAC token logic, middleware, D1 auth
    │   ├── db/
    │   │   ├── d1.ts          # Client-safe: CloudflareEnv type export only
    │   │   └── d1.server.ts   # Server-only: getCloudflareEnv, getD1Database, getR2Bucket
    │   └── cms/
    │       ├── types.ts        # Zod schemas + TypeScript types for all CMS entities
    │       ├── public.functions.ts  # Server functions for public data (projects, now, resume)
    │       ├── admin.functions.ts   # Server functions for admin CRUD + analytics
    │       └── queries.ts      # TanStack Query queryOptions wrappers
    │
    ├── components/
    │   ├── site/              # Public portfolio components
    │   └── ui/                # shadcn/ui primitive components
    │
    ├── server.ts              # Cloudflare Worker SSR entry point (error normalisation)
    ├── start.ts               # TanStack Start instance + CSRF/error middleware
    └── styles.css             # Global CSS design tokens (HSL palette, typography)
```

---

## Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) ≥ 20 or [Bun](https://bun.sh/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)
- A Cloudflare account (free tier works for development)

### 1. Install dependencies
```bash
npm install
```

### 2. Set environment variables
```bash
cp .env.sample .env
```
Edit `.env` and set `ADMIN_SESSION_SECRET` to a random 32+ character string.

### 3. Initialise the local D1 database
```bash
npm run d1:setup
```
This runs the schema from `d1-schema.sql` against Wrangler's local D1 emulator (stored in `.wrangler/state/`).

> **Already have data?** `d1-schema.sql` drops and recreates every table. If you're upgrading an
> existing local or deployed database instead of starting fresh, run the additive migration
> instead so you don't lose anything:
> ```bash
> npx wrangler d1 execute portfolio_db --local  --file=./d1-migration-001-admin-settings.sql
> npx wrangler d1 execute portfolio_db --remote --file=./d1-migration-001-admin-settings.sql
> ```
> This adds the browser tab title, favicon, and editable Now-board category list introduced
> in the Site Config and Now Board admin pages.

### 4. Start the development server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000).

> **First login**: Navigate to `/auth`. Enter any email + password - the first account registered automatically becomes admin.

---

## Production Deployment on Cloudflare

### Step 1 - Create cloud resources
```bash
# Create D1 database
npx wrangler d1 create portfolio_db

# Create R2 bucket for media
npx wrangler r2 bucket create portfolio-media
```
Copy the `database_id` output from the D1 command.

### Step 2 - Update `wrangler.json`
Replace `<YOUR_D1_DATABASE_ID>` with the ID from step 1:
```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "portfolio_db",
      "database_id": "<YOUR_D1_DATABASE_ID>"
    }
  ]
}
```

### Step 3 - Apply schema to production D1
```bash
npm run d1:setup:remote
```

### Step 4 - Set production secrets
Set your environment secrets in Cloudflare Pages dashboard (Settings → Environment variables) or via Wrangler:
```bash
npx wrangler secret put ADMIN_SESSION_SECRET
# Optionally:
npx wrangler secret put TURNSTILE_SECRET_KEY
```
Set `VITE_TURNSTILE_SITE_KEY` as a plain variable (non-secret) so it can be embedded at build time.

### Step 5 - Build and deploy
```bash
npm run build
npx wrangler pages deploy .output/public
```
Or connect your repository to **Cloudflare Pages** for automatic deployments on every push.

---

## Environment Variables Reference

| Variable | Where | Description |
|---|---|---|
| `ADMIN_SESSION_SECRET` | Worker secret | 32+ char random string for HMAC session signing |
| `TURNSTILE_SECRET_KEY` | Worker secret | Cloudflare Turnstile server-side key (optional) |
| `VITE_TURNSTILE_SITE_KEY` | Build-time variable | Cloudflare Turnstile site key (optional) |

> **D1 and R2 are not environment variables** - they are bindings declared in `wrangler.json` and injected by the Cloudflare runtime automatically.

---

## Admin Authentication

Authentication is built entirely on Web Platform APIs - no external auth library:

1. Admin signs in via `/auth`
2. Password is verified against a bcrypt-style SHA-256 hash stored in D1
3. On success, a signed **HMAC-SHA256 session token** is created and set as an HttpOnly cookie
4. Every admin server function runs the `requireAdminAuth` middleware which verifies the token
5. Sessions expire after **7 days**

The first account to register gains admin access. There is no invite flow - protect your `/auth` route accordingly in production (e.g. via Cloudflare Access).

---

## Media Uploads

Media files are uploaded via the admin Assets panel:
1. File is base64-encoded client-side and sent to the `uploadMedia` server function
2. Server decodes and writes the binary to **Cloudflare R2** under a `year/timestamp-name` path
3. A record is created in the `media_assets` D1 table with the public URL
4. Files are served publicly at `/api/media/<path>` via the R2 proxy route with aggressive cache headers

---

## Analytics

The analytics system is **fully privacy-first**:
- Raw IP addresses are **never stored** - only a daily SHA-256 hash keyed per-day is stored as `visitor_key`
- No cookies or fingerprinting beyond the hashed visitor key
- Pageview data includes: path, referrer hostname, country (from Cloudflare header), and date
- The admin Analytics panel shows: total views, unique visitors, last-24h views, daily chart, top pages, top referrers

---

## Database Schema Overview

| Table | Description |
|---|---|
| `site_config` | Single-row identity and configuration |
| `projects` | Portfolio pieces (slug, title, body, tags, cover, links) |
| `now_items` | "What I'm doing now" categorised items |
| `resume_sections` | CV section headers (sortable, hideable) |
| `resume_entries` | CV entries within sections (sortable, hideable) |
| `contact_messages` | Incoming contact form submissions |
| `media_assets` | R2-stored media metadata (path, URL, size, type) |
| `pageviews` | Privacy-safe analytics events |
| `admin_users` | Admin accounts (email + password hash) |

---

## License

MIT - built for independent creators and systems engineers. Own your stack.
