import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  LEGAL_PAGE_KEYS,
  NOW_CATEGORIES,
  PAGE_META_KEYS,
  type AnalyticsSummary,
  type FaqItem,
  type LegalPage,
  type LegalPageKey,
  type NowItem,
  type PageMeta,
  type PageMetaKey,
  type Project,
  type ResumeSectionWithEntries,
  type SiteConfig,
  type SocialLink,
} from "./types";

/**
 * Helper utilities for dynamic server imports
 * Prevents client bundle leaks and fixes [import-protection] build errors
 */
async function getDb() {
  const { getD1Database } = await import("@/lib/db/d1.server");
  return getD1Database();
}

/**
 * PUBLIC DATA LAYER (Cloudflare D1 Native)
 */

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      return [];
    }
  }
  return [];
}

function parseSocials(value: unknown): SocialLink[] {
  const items = parseJsonArray<Record<string, unknown>>(value);
  return items.flatMap((record) => {
    if (typeof record["label"] !== "string" || typeof record["url"] !== "string") return [];
    return [{ label: record["label"], url: record["url"] }];
  });
}

function parseCategories(value: unknown): string[] {
  const items = parseJsonArray<unknown>(value).filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return items.length > 0 ? items : [...NOW_CATEGORIES];
}

const FALLBACK_CONFIG: SiteConfig = {
  id: "fallback",
  owner_name: "Portfolio OS",
  initials: "OS",
  system_name: "PORTFOLIO_OS",
  status: "Available",
  location: "Earth",
  hero_line_one: "Systems, interfaces",
  hero_line_two: "and everything between.",
  bio: "Configure this text from the admin control dashboard.",
  contact_email: "hello@example.com",
  meta_description: "A self-hosted portfolio and content management system.",
  build_version: "0.1.0",
  resume_pdf_url: null,
  socials: [],
  site_title: "Portfolio OS",
  favicon_url: null,
  now_categories: [...NOW_CATEGORIES],
  updated_at: new Date().toISOString(),
};

interface D1SiteConfigRow {
  id: string;
  owner_name: string;
  initials: string;
  system_name: string;
  hero_line_one: string;
  hero_line_two: string;
  bio: string;
  status: string;
  location: string;
  contact_email: string;
  resume_pdf_url: string | null;
  build_version: string;
  socials_json: string;
  meta_description: string;
  site_title: string;
  favicon_url: string | null;
  now_categories_json: string;
  updated_at: string;
}

interface D1ProjectRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  cover_url: string | null;
  tags_json: string;
  live_url: string | null;
  source_url: string | null;
  year: number;
  featured: number;
  published: number;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

interface D1NowItemRow {
  id: string;
  title: string;
  description: string;
  category: string;
  sort_order: number;
  published: number;
  image_url?: string | null;
  link_url?: string | null;
  created_at: string;
  updated_at: string;
}

interface D1ResumeSectionRow {
  id: string;
  title: string;
  sort_order: number;
  hidden: number;
  created_at: string;
  updated_at: string;
}

interface D1ResumeEntryRow {
  id: string;
  section_id: string;
  role: string;
  organization: string;
  start_date: string;
  end_date: string;
  location: string;
  description: string;
  bullets_json: string;
  sort_order: number;
  hidden: number;
  created_at: string;
  updated_at: string;
}

function mapProject(row: D1ProjectRow): Project {
  return {
    ...row,
    tags: parseJsonArray<string>(row.tags_json),
    featured: Boolean(row.featured),
    published: Boolean(row.published),
  };
}

export const getSiteConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteConfig> => {
    try {
      const db = await getDb();
      const row = await db
        .prepare("SELECT * FROM site_config WHERE id = 'default' LIMIT 1")
        .first<D1SiteConfigRow>();
      if (!row) return FALLBACK_CONFIG;

      return {
        id: row.id,
        owner_name: row.owner_name,
        initials: row.initials,
        system_name: row.system_name,
        hero_line_one: row.hero_line_one,
        hero_line_two: row.hero_line_two,
        bio: row.bio,
        status: row.status,
        location: row.location,
        contact_email: row.contact_email,
        resume_pdf_url: row.resume_pdf_url,
        build_version: row.build_version,
        socials: parseSocials(row.socials_json),
        meta_description: row.meta_description,
        site_title: row.site_title || FALLBACK_CONFIG.site_title,
        favicon_url: row.favicon_url,
        now_categories: parseCategories(row.now_categories_json),
        updated_at: row.updated_at,
      };
    } catch (err) {
      console.warn("[getSiteConfig] D1 query failed, using fallback:", err);
      return FALLBACK_CONFIG;
    }
  },
);

const FALLBACK_PAGE_META: Record<PageMetaKey, PageMeta> = {
  home: {
    page_key: "home",
    title: "Portfolio OS - Engineering index & live work log",
    description: "Portfolio, projects, resume and current work of an independent systems-minded developer.",
  },
  projects: {
    page_key: "projects",
    title: "Projects - Portfolio OS",
    description: "Case studies and shipped work - systems, tools and interfaces.",
  },
  resume: {
    page_key: "resume",
    title: "Resume - experience, systems and credentials",
    description: "Experience, skills, and credentials.",
  },
  now: {
    page_key: "now",
    title: "Now - current focus, reading and builds",
    description: "What I am building, reading, and shipping right now.",
  },
  contact: {
    page_key: "contact",
    title: "Contact - open a direct channel",
    description: "Get in touch directly - email or socials.",
  },
};

/** Editable title/description for every static page (Home, Projects, Resume, Now, Contact). */
export const getPageMeta = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<PageMetaKey, PageMeta>> => {
    try {
      const db = await getDb();
      const { results } = await db
        .prepare("SELECT page_key, title, description FROM page_meta")
        .all<{ page_key: string; title: string; description: string }>();

      const merged = { ...FALLBACK_PAGE_META };
      for (const row of results || []) {
        if ((PAGE_META_KEYS as readonly string[]).includes(row.page_key)) {
          merged[row.page_key as PageMetaKey] = {
            page_key: row.page_key as PageMetaKey,
            title: row.title,
            description: row.description,
          };
        }
      }
      return merged;
    } catch (err) {
      console.warn("[getPageMeta] D1 query failed, using fallback:", err);
      return FALLBACK_PAGE_META;
    }
  },
);

/** Published FAQ entries, in display order. Dashboard-editable at /admin/content. */
export const getFaqItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<FaqItem[]> => {
    try {
      const db = await getDb();
      const { results } = await db
        .prepare(
          "SELECT * FROM faq_items WHERE published = 1 ORDER BY sort_order ASC, created_at ASC",
        )
        .all<{
          id: string;
          question: string;
          answer: string;
          published: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        }>();
      return (results || []).map((row) => ({ ...row, published: Boolean(row.published) }));
    } catch (err) {
      console.warn("[getFaqItems] D1 query failed, using empty list:", err);
      return [];
    }
  },
);

const FALLBACK_LEGAL: Record<LegalPageKey, LegalPage> = {
  privacy: { page_key: "privacy", title: "Privacy policy", body_html: "<p>Coming soon.</p>" },
  terms: { page_key: "terms", title: "Terms of use", body_html: "<p>Coming soon.</p>" },
};

/** Privacy/Terms page content. Dashboard-editable at /admin/content. */
export const getLegalPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ pageKey: z.enum(LEGAL_PAGE_KEYS) }).parse(input))
  .handler(async ({ data }): Promise<LegalPage> => {
    try {
      const db = await getDb();
      const row = await db
        .prepare("SELECT page_key, title, body_html FROM legal_pages WHERE page_key = ? LIMIT 1")
        .bind(data.pageKey)
        .first<{ page_key: string; title: string; body_html: string }>();
      if (!row) return FALLBACK_LEGAL[data.pageKey];
      return { page_key: data.pageKey, title: row.title, body_html: row.body_html };
    } catch (err) {
      console.warn("[getLegalPage] D1 query failed, using fallback:", err);
      return FALLBACK_LEGAL[data.pageKey];
    }
  });

export const listProjects = createServerFn({ method: "GET" }).handler(
  async (): Promise<Project[]> => {
    try {
      const db = await getDb();
      const { results } = await db
        .prepare(
          "SELECT * FROM projects WHERE published = 1 ORDER BY sort_order ASC, year DESC",
        )
        .all<D1ProjectRow>();
      return (results || []).map(mapProject);
    } catch {
      return [];
    }
  },
);

export const getProjectBySlug = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 120) }))
  .handler(async ({ data }): Promise<Project | null> => {
    try {
      const db = await getDb();
      const row = await db
        .prepare("SELECT * FROM projects WHERE slug = ? AND published = 1 LIMIT 1")
        .bind(data.slug)
        .first<D1ProjectRow>();
      return row ? mapProject(row) : null;
    } catch {
      return null;
    }
  });

export const listNowItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<NowItem[]> => {
    try {
      const db = await getDb();
      const { results } = await db
        .prepare("SELECT * FROM now_items WHERE published = 1 ORDER BY sort_order ASC")
        .all<D1NowItemRow>();
      return (results || []).map((row: D1NowItemRow) => ({
        ...row,
        image_url: row.image_url ?? null,
        link_url: row.link_url ?? null,
        published: Boolean(row.published),
      }));
    } catch {
      return [];
    }
  },
);

export const getResume = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResumeSectionWithEntries[]> => {
    try {
      const db = await getDb();
      const [sectionsRes, entriesRes] = await Promise.all([
        db
          .prepare(
            "SELECT id, title, hidden, sort_order FROM resume_sections WHERE hidden = 0 ORDER BY sort_order ASC",
          )
          .all<D1ResumeSectionRow>(),
        db
          .prepare(
            "SELECT * FROM resume_entries WHERE hidden = 0 ORDER BY sort_order ASC",
          )
          .all<D1ResumeEntryRow>(),
      ]);

      const sections = sectionsRes.results || [];
      const entries = entriesRes.results || [];

      return sections.map((sec: D1ResumeSectionRow) => ({
        id: sec.id,
        title: sec.title,
        sort_order: sec.sort_order,
        hidden: Boolean(sec.hidden),
        entries: entries
          .filter((ent: D1ResumeEntryRow) => ent.section_id === sec.id)
          .map((ent: D1ResumeEntryRow) => ({
            ...ent,
            bullets: parseJsonArray<string>(ent.bullets_json),
            hidden: Boolean(ent.hidden),
          })),
      }));
    } catch {
      return [];
    }
  },
);

/** Privacy-first pageview beacon stored in Cloudflare D1. */
export const trackPageview = createServerFn({ method: "POST" })
  .validator((input: { path: string; referrer?: string }) => ({
    path: String(input.path ?? "/").slice(0, 300),
    referrer: input.referrer ? String(input.referrer).slice(0, 300) : "",
  }))
  .handler(async ({ data }) => {
    try {
      const db = await getDb();
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      const headers = request?.headers;
      const ip = headers?.get("cf-connecting-ip") ?? headers?.get("x-forwarded-for") ?? "unknown";
      const ua = headers?.get("user-agent") ?? "unknown";
      const country = headers?.get("cf-ipcountry") ?? null;
      const day = new Date().toISOString().slice(0, 10);

      const raw = new TextEncoder().encode(`${ip}|${ua}|${day}|portfolio-os`);
      const digest = await crypto.subtle.digest("SHA-256", raw);
      const visitorKey = Array.from(new Uint8Array(digest))
        .slice(0, 16)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const id = crypto.randomUUID();

      await db
        .prepare(
          "INSERT INTO pageviews (id, path, referrer, country, visitor_key, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        )
        .bind(id, data.path, data.referrer || null, country && country !== "XX" ? country : null, visitorKey)
        .run();
    } catch {
      // Analytics must never break a page render.
    }
    return { ok: true };
  });

export type { AnalyticsSummary };