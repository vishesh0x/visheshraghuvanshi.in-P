import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  faqItemInputSchema,
  legalPageInputSchema,
  nowItemInputSchema,
  NOW_CATEGORIES,
  pageMetaInputSchema,
  projectInputSchema,
  resumeEntryInputSchema,
  siteConfigInputSchema,
  type AnalyticsSummary,
  type ContactMessage,
  type FaqItem,
  type LegalPage,
  type MediaAsset,
  type NowItem,
  type PageMeta,
  type Project,
  type ResumeSectionWithEntries,
} from "./types";

/**
 * Helper utilities for dynamic server imports
 * Prevents client bundle leaks and fixes [import-protection] build errors
 */
async function getDb() {
  const { getD1Database } = await import("@/lib/db/d1.server");
  return getD1Database();
}

async function getR2() {
  const { getR2Bucket } = await import("@/lib/db/d1.server");
  return getR2Bucket();
}

async function checkAuth(): Promise<{ userId: string }> {
  const { requireAdmin } = await import("@/lib/auth/admin-auth.server");
  return requireAdmin();
}

/**
 * ADMIN DATA LAYER (Cloudflare D1 + R2 Native)
 */

const idInput = z.object({ id: z.string().min(1) });
const reorderInput = z.object({ ids: z.array(z.string().min(1)).max(500) });

/**
 * Strip inline color/background styles (and legacy <font color>) from
 * rich-text HTML before it's persisted. Content pasted in from Word,
 * Notion, Google Docs, etc. carries hardcoded inline colors that override
 * theme CSS by specificity - this keeps stored bodies theme-clean.
 */
function stripInlineColorHtml(html: string): string {
  if (!html) return html;
  return html
    .replace(/style="([^"]*)"/gi, (_match, styleContent: string) => {
      const cleaned = styleContent
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(
          (declaration) =>
            declaration &&
            !/^color\s*:/i.test(declaration) &&
            !/^background(-color)?\s*:/i.test(declaration),
        )
        .join("; ");
      return cleaned ? `style="${cleaned}"` : "";
    })
    .replace(/(<font\b[^>]*)\scolor="[^"]*"/gi, "$1");
}

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

export const getAdminSession = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = await checkAuth();
    if (!auth?.userId) {
      return { userId: null, email: null, isAdmin: false };
    }

    const db = await getDb();
    const user = await db
      .prepare("SELECT id, email FROM admin_users WHERE id = ? LIMIT 1")
      .bind(auth.userId)
      .first<{ id: string; email: string }>();

    if (!user) {
      // Session token verified but the account behind it no longer exists.
      return { userId: auth.userId, email: null, isAdmin: false };
    }

    return {
      userId: user.id,
      email: user.email,
      // Every row in admin_users is a full operator today - there is no
      // separate "read-only" role in the schema yet.
      isAdmin: true,
    };
  });

export const getOverview = createServerFn({ method: "GET" })
  .handler(async () => {
    await checkAuth();
    const db = await getDb();
    const since = new Date(Date.now() - 7 * 86400000).toISOString();

    const [projectsRow, publishedRow, nowRow, unreadRow, messagesRow, viewsRow] = await Promise.all([
      db.prepare("SELECT COUNT(*) as count FROM projects").first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM projects WHERE published = 1").first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM now_items WHERE published = 1").first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM contact_messages WHERE is_read = 0").first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM contact_messages").first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM pageviews WHERE created_at >= ?").bind(since).first<{ count: number }>(),
    ]);

    const { results: recent } = await db
      .prepare(
        "SELECT id, name, email, subject, message, is_read, is_starred, country, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5",
      )
      .all<ContactMessage>();

    return {
      projectCount: projectsRow?.count ?? 0,
      publishedCount: publishedRow?.count ?? 0,
      nowCount: nowRow?.count ?? 0,
      unreadCount: unreadRow?.count ?? 0,
      messageCount: messagesRow?.count ?? 0,
      weeklyViews: viewsRow?.count ?? 0,
      recentMessages: (recent || []).map((msg: ContactMessage) => ({
        ...msg,
        is_read: Boolean(msg.is_read),
        is_starred: Boolean(msg.is_starred),
      })),
    };
  });

/* ------------------------------------------------------------------ site */

export const updateSiteConfig = createServerFn({ method: "POST" })
  .validator((input: unknown) => siteConfigInputSchema.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const socialsJson = JSON.stringify(data.socials ?? []);
    const categoriesJson = JSON.stringify(
      data.now_categories.length > 0 ? data.now_categories : NOW_CATEGORIES,
    );

    await db
      .prepare(
        `UPDATE site_config SET
          owner_name = ?, initials = ?, system_name = ?, hero_line_one = ?, hero_line_two = ?,
          bio = ?, status = ?, location = ?, contact_email = ?, resume_pdf_url = ?,
          build_version = ?, socials_json = ?, meta_description = ?, site_title = ?,
          favicon_url = ?, now_categories_json = ?, updated_at = datetime('now')
        WHERE id = 'default'`,
      )
      .bind(
        data.owner_name,
        data.initials,
        data.system_name,
        data.hero_line_one,
        data.hero_line_two,
        data.bio,
        data.status,
        data.location,
        data.contact_email,
        data.resume_pdf_url || null,
        data.build_version,
        socialsJson,
        data.meta_description,
        data.site_title,
        data.favicon_url || null,
        categoriesJson,
      )
      .run();

    return { ok: true };
  });

export const getAdminPageMeta = createServerFn({ method: "GET" }).handler(
  async (): Promise<PageMeta[]> => {
    await checkAuth();
    const db = await getDb();
    const { results } = await db
      .prepare("SELECT page_key, title, description FROM page_meta ORDER BY page_key ASC")
      .all<PageMeta>();
    return results || [];
  },
);

export const updatePageMeta = createServerFn({ method: "POST" })
  .validator((input: unknown) => pageMetaInputSchema.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    await db
      .prepare(
        `INSERT INTO page_meta (page_key, title, description) VALUES (?, ?, ?)
         ON CONFLICT(page_key) DO UPDATE SET title = excluded.title, description = excluded.description`,
      )
      .bind(data.page_key, data.title, data.description)
      .run();
    return { ok: true };
  });

/* --------------------------------------------------------- faq + legal */

export const adminListFaqItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<FaqItem[]> => {
    await checkAuth();
    const db = await getDb();
    const { results } = await db
      .prepare("SELECT * FROM faq_items ORDER BY sort_order ASC, created_at ASC")
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
  },
);

export const upsertFaqItem = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().min(1).nullable(), values: faqItemInputSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const v = data.values;

    if (data.id) {
      await db
        .prepare(
          `UPDATE faq_items SET question = ?, answer = ?, published = ?, sort_order = ?, updated_at = datetime('now')
          WHERE id = ?`,
        )
        .bind(v.question, v.answer, v.published ? 1 : 0, v.sort_order, data.id)
        .run();
      return { id: data.id };
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO faq_items (id, question, answer, published, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(id, v.question, v.answer, v.published ? 1 : 0, v.sort_order)
      .run();
    return { id };
  });

export const deleteFaqItem = createServerFn({ method: "POST" })
  .validator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    await db.prepare("DELETE FROM faq_items WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });

export const reorderFaqItems = createServerFn({ method: "POST" })
  .validator((input: unknown) => reorderInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    await db.batch(
      data.ids.map((id, index) =>
        db.prepare("UPDATE faq_items SET sort_order = ? WHERE id = ?").bind(index, id),
      ),
    );
    return { ok: true };
  });

export const adminGetLegalPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ pageKey: z.enum(["privacy", "terms"]) }).parse(input))
  .handler(async ({ data }): Promise<LegalPage> => {
    await checkAuth();
    const db = await getDb();
    const row = await db
      .prepare("SELECT page_key, title, body_html FROM legal_pages WHERE page_key = ? LIMIT 1")
      .bind(data.pageKey)
      .first<{ page_key: string; title: string; body_html: string }>();
    return row
      ? { page_key: data.pageKey, title: row.title, body_html: row.body_html }
      : { page_key: data.pageKey, title: "", body_html: "" };
  });

export const updateLegalPage = createServerFn({ method: "POST" })
  .validator((input: unknown) => legalPageInputSchema.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const cleanBody = stripInlineColorHtml(data.body_html);
    await db
      .prepare(
        `INSERT INTO legal_pages (page_key, title, body_html) VALUES (?, ?, ?)
         ON CONFLICT(page_key) DO UPDATE SET title = excluded.title, body_html = excluded.body_html`,
      )
      .bind(data.page_key, data.title, cleanBody)
      .run();
    return { ok: true };
  });

const updateNowCategoriesInput = z.object({
  categories: z.array(z.string().trim().min(1).max(32)).max(40),
});

export const updateNowCategories = createServerFn({ method: "POST" })
  .validator((input: unknown) => updateNowCategoriesInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const deduped = [...new Set(data.categories.map((category) => category.trim()))];
    const categoriesJson = JSON.stringify(deduped.length > 0 ? deduped : NOW_CATEGORIES);

    await db
      .prepare(
        `UPDATE site_config SET now_categories_json = ?, updated_at = datetime('now') WHERE id = 'default'`,
      )
      .bind(categoriesJson)
      .run();

    return { ok: true, categories: deduped.length > 0 ? deduped : [...NOW_CATEGORIES] };
  });

/* -------------------------------------------------------------- projects */

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

function mapProject(row: D1ProjectRow): Project {
  return {
    ...row,
    tags: parseJsonArray<string>(row.tags_json),
    featured: Boolean(row.featured),
    published: Boolean(row.published),
  };
}

export const adminListProjects = createServerFn({ method: "GET" })
  .handler(async (): Promise<Project[]> => {
    await checkAuth();
    const db = await getDb();
    const { results } = await db.prepare("SELECT * FROM projects ORDER BY sort_order ASC").all<D1ProjectRow>();
    return (results || []).map(mapProject);
  });

export const upsertProject = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().min(1).nullable(), values: projectInputSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const v = data.values;
    const tagsJson = JSON.stringify(v.tags ?? []);
    const cleanBody = stripInlineColorHtml(v.body);

    if (data.id) {
      await db
        .prepare(
          `UPDATE projects SET
            slug = ?, title = ?, summary = ?, body = ?, cover_url = ?, tags_json = ?,
            live_url = ?, source_url = ?, year = ?, featured = ?, published = ?, sort_order = ?,
            meta_title = ?, meta_description = ?, updated_at = datetime('now')
          WHERE id = ?`,
        )
        .bind(
          v.slug,
          v.title,
          v.summary,
          cleanBody,
          v.cover_url || null,
          tagsJson,
          v.live_url || null,
          v.source_url || null,
          v.year,
          v.featured ? 1 : 0,
          v.published ? 1 : 0,
          v.sort_order,
          v.meta_title || null,
          v.meta_description || null,
          data.id,
        )
        .run();
      return { id: data.id };
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO projects (id, slug, title, summary, body, cover_url, tags_json, live_url, source_url, year, featured, published, sort_order, meta_title, meta_description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(
        id,
        v.slug,
        v.title,
        v.summary,
        cleanBody,
        v.cover_url || null,
        tagsJson,
        v.live_url || null,
        v.source_url || null,
        v.year,
        v.featured ? 1 : 0,
        v.published ? 1 : 0,
        v.sort_order,
        v.meta_title || null,
        v.meta_description || null,
      )
      .run();

    return { id };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .validator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    await db.prepare("DELETE FROM projects WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });

export const reorderProjects = createServerFn({ method: "POST" })
  .validator((input: unknown) => reorderInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const stmts = data.ids.map((id, index) =>
      db.prepare("UPDATE projects SET sort_order = ? WHERE id = ?").bind(index, id),
    );
    await db.batch(stmts);
    return { ok: true };
  });

/* ------------------------------------------------------------------- now */

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

export const adminListNowItems = createServerFn({ method: "GET" })
  .handler(async (): Promise<NowItem[]> => {
    await checkAuth();
    const db = await getDb();
    const { results } = await db.prepare("SELECT * FROM now_items ORDER BY sort_order ASC").all<D1NowItemRow>();
    return (results || []).map((row: D1NowItemRow) => ({
      ...row,
      image_url: row.image_url ?? null,
      link_url: row.link_url ?? null,
      published: Boolean(row.published),
    }));
  });

export const upsertNowItem = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().min(1).nullable(), values: nowItemInputSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const v = data.values;

    if (data.id) {
      await db
        .prepare(
          `UPDATE now_items SET
            title = ?, description = ?, category = ?, sort_order = ?, published = ?, updated_at = datetime('now')
          WHERE id = ?`,
        )
        .bind(v.title, v.description, v.category, v.sort_order, v.published ? 1 : 0, data.id)
        .run();
      return { id: data.id };
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO now_items (id, title, description, category, sort_order, published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(id, v.title, v.description, v.category, v.sort_order, v.published ? 1 : 0)
      .run();

    return { id };
  });

export const deleteNowItem = createServerFn({ method: "POST" })
  .validator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    await db.prepare("DELETE FROM now_items WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });

export const reorderNowItems = createServerFn({ method: "POST" })
  .validator((input: unknown) => reorderInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const stmts = data.ids.map((id, index) =>
      db.prepare("UPDATE now_items SET sort_order = ? WHERE id = ?").bind(index, id),
    );
    await db.batch(stmts);
    return { ok: true };
  });

/* ---------------------------------------------------------------- resume */

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

export const adminGetResume = createServerFn({ method: "GET" })
  .handler(async (): Promise<ResumeSectionWithEntries[]> => {
    await checkAuth();
    const db = await getDb();
    const [sectionsRes, entriesRes] = await Promise.all([
      db.prepare("SELECT * FROM resume_sections ORDER BY sort_order ASC").all<D1ResumeSectionRow>(),
      db.prepare("SELECT * FROM resume_entries ORDER BY sort_order ASC").all<D1ResumeEntryRow>(),
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
  });

export const upsertResumeSection = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(1).nullable(),
        title: z.string().trim().min(1).max(80),
        hidden: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    if (data.id) {
      await db
        .prepare("UPDATE resume_sections SET title = ?, hidden = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(data.title, data.hidden ? 1 : 0, data.id)
        .run();
      return { id: data.id };
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO resume_sections (id, title, hidden, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
      )
      .bind(id, data.title, data.hidden ? 1 : 0)
      .run();
    return { id };
  });

export const deleteResumeSection = createServerFn({ method: "POST" })
  .validator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    await db.prepare("DELETE FROM resume_sections WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });

export const upsertResumeEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().min(1).nullable(), values: resumeEntryInputSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const v = data.values;
    const bulletsJson = JSON.stringify(v.bullets ?? []);

    if (data.id) {
      await db
        .prepare(
          `UPDATE resume_entries SET
            section_id = ?, role = ?, organization = ?, start_date = ?, end_date = ?,
            location = ?, description = ?, bullets_json = ?, sort_order = ?, hidden = ?, updated_at = datetime('now')
          WHERE id = ?`,
        )
        .bind(
          v.section_id,
          v.role,
          v.organization,
          v.start_date,
          v.end_date,
          v.location,
          v.description,
          bulletsJson,
          v.sort_order ?? 0,
          v.hidden ? 1 : 0,
          data.id,
        )
        .run();
      return { id: data.id };
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO resume_entries (id, section_id, role, organization, start_date, end_date, location, description, bullets_json, sort_order, hidden, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(
        id,
        v.section_id,
        v.role,
        v.organization,
        v.start_date,
        v.end_date,
        v.location,
        v.description,
        bulletsJson,
        v.sort_order ?? 0,
        v.hidden ? 1 : 0,
      )
      .run();

    return { id };
  });

export const deleteResumeEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    await db.prepare("DELETE FROM resume_entries WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });

export const saveResumeLayout = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        sections: z
          .array(
            z.object({
              id: z.string().min(1),
              entryIds: z.array(z.string().min(1)).max(200),
            }),
          )
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const stmts: ReturnType<typeof db.prepare>[] = [];

    data.sections.forEach((section, sectionIndex) => {
      stmts.push(
        db
          .prepare("UPDATE resume_sections SET sort_order = ? WHERE id = ?")
          .bind(sectionIndex, section.id),
      );
      section.entryIds.forEach((entryId, entryIndex) => {
        stmts.push(
          db
            .prepare("UPDATE resume_entries SET sort_order = ?, section_id = ? WHERE id = ?")
            .bind(entryIndex, section.id, entryId),
        );
      });
    });

    if (stmts.length > 0) {
      await db.batch(stmts);
    }
    return { ok: true };
  });

/* ----------------------------------------------------------------- inbox */

export const listMessages = createServerFn({ method: "GET" })
  .handler(async (): Promise<ContactMessage[]> => {
    await checkAuth();
    const db = await getDb();
    const { results } = await db
      .prepare(
        "SELECT id, name, email, subject, message, is_read, is_starred, country, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 300",
      )
      .all<ContactMessage>();

    return (results || []).map((msg: ContactMessage) => ({
      ...msg,
      is_read: Boolean(msg.is_read),
      is_starred: Boolean(msg.is_starred),
    }));
  });

export const updateMessageFlags = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        is_read: z.boolean().optional(),
        is_starred: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    if (data.is_read !== undefined) {
      await db
        .prepare("UPDATE contact_messages SET is_read = ? WHERE id = ?")
        .bind(data.is_read ? 1 : 0, data.id)
        .run();
    }
    if (data.is_starred !== undefined) {
      await db
        .prepare("UPDATE contact_messages SET is_starred = ? WHERE id = ?")
        .bind(data.is_starred ? 1 : 0, data.id)
        .run();
    }
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .validator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    await db.prepare("DELETE FROM contact_messages WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });

/* ----------------------------------------------------------------- media */

export const listMedia = createServerFn({ method: "GET" })
  .handler(async (): Promise<MediaAsset[]> => {
    await checkAuth();
    const db = await getDb();
    const { results } = await db
      .prepare("SELECT * FROM media_assets ORDER BY created_at DESC")
      .all<MediaAsset>();
    return results || [];
  });

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "application/pdf",
]);

// 8MB covers portfolio cover images, favicons and a resume PDF comfortably
// while keeping the base64-encoded request body (roughly 1.33x the raw
// file size) well under typical Worker/Pages request body limits.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const uploadMedia = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(160),
        mimeType: z.string().trim().max(120),
        base64: z.string().max(14_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await checkAuth();

    // Allow-list rather than trusting the client-supplied MIME type outright:
    // uploads served back from /api/media/<path> are same-origin, so an
    // unrestricted "text/html" or "image/svg+xml" (which can carry <script>)
    // upload would be a stored-XSS vector against whoever opens the file
    // directly - SVG is deliberately excluded below even though it's a
    // common favicon format for this reason.
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(data.mimeType)) {
      throw new Error(
        `Unsupported file type "${data.mimeType}". Allowed: PNG, JPEG, WebP, GIF, AVIF, ICO, PDF.`,
      );
    }

    const db = await getDb();
    const r2 = await getR2();

    const binary = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0));

    if (binary.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error(
        `File is ${(binary.byteLength / (1024 * 1024)).toFixed(1)}MB - the limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`,
      );
    }

    const safeName = data.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
    const path = `${new Date().getFullYear()}/${Date.now()}-${safeName}`;
    const mimeType = data.mimeType || "application/octet-stream";

    if (r2) {
      await r2.put(path, binary.buffer, {
        httpMetadata: { contentType: mimeType },
      });
    }

    const id = crypto.randomUUID();
    const url = `/api/media/${path}`;

    await db
      .prepare(
        "INSERT INTO media_assets (id, name, path, url, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
      )
      .bind(id, data.name, path, url, mimeType, binary.byteLength)
      .run();

    return {
      id,
      name: data.name,
      path,
      url,
      mime_type: mimeType,
      size_bytes: binary.byteLength,
      created_at: new Date().toISOString(),
    };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .validator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const r2 = await getR2();

    const row = await db
      .prepare("SELECT path FROM media_assets WHERE id = ? LIMIT 1")
      .bind(data.id)
      .first<{ path: string }>();

    if (row?.path && r2) {
      await r2.delete(row.path);
    }

    await db.prepare("DELETE FROM media_assets WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });

/**
 * R2 recovery / reconciliation - lists objects directly from the bucket,
 * independent of the D1 `media_assets` table. Use this if the database was
 * ever wiped or restored from an older backup: the actual files in R2 are a
 * separate service from D1 and are untouched by deleting/recreating the
 * database, so this lets you see and recover anything still sitting there
 * that the metadata table has forgotten about.
 */
export const listR2Objects = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    { path: string; size: number; uploaded: string; knownInDb: boolean; url: string }[]
  > => {
    await checkAuth();
    const db = await getDb();
    const r2 = await getR2();

    const known = new Set<string>();
    try {
      const { results } = await db.prepare("SELECT path FROM media_assets").all<{ path: string }>();
      for (const row of results || []) known.add(row.path);
    } catch {
      // media_assets table missing/empty (e.g. after a DB wipe) - everything
      // in the bucket is then reported as "not yet known in DB".
    }

    const objects: { path: string; size: number; uploaded: string; knownInDb: boolean; url: string }[] = [];
    let cursor: string | undefined;
    do {
      const listed = await r2.list({ cursor, limit: 1000 });
      for (const obj of listed.objects) {
        objects.push({
          path: obj.key,
          size: obj.size,
          uploaded: obj.uploaded.toISOString(),
          knownInDb: known.has(obj.key),
          url: `/api/media/${obj.key}`,
        });
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    objects.sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1));
    return objects;
  },
);

/** Re-create a media_assets row for an R2 object that exists but has no DB record. */
export const importR2Object = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const db = await getDb();
    const r2 = await getR2();

    const object = await r2.head(data.path);
    if (!object) {
      throw new Error("That object no longer exists in R2 storage.");
    }

    const existing = await db
      .prepare("SELECT id FROM media_assets WHERE path = ? LIMIT 1")
      .bind(data.path)
      .first<{ id: string }>();
    if (existing) {
      return { ok: true, id: existing.id, alreadyImported: true };
    }

    const id = crypto.randomUUID();
    const name = data.path.split("/").pop() || data.path;
    const mimeType = object.httpMetadata?.contentType || "application/octet-stream";

    await db
      .prepare(
        "INSERT INTO media_assets (id, name, path, url, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, name, data.path, `/api/media/${data.path}`, mimeType, object.size, object.uploaded.toISOString())
      .run();

    return { ok: true, id, alreadyImported: false };
  });

/** Permanently delete an R2 object directly (bypasses the media_assets table). */
export const deleteR2Object = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await checkAuth();
    const r2 = await getR2();
    await r2.delete(data.path);

    const db = await getDb();
    await db.prepare("DELETE FROM media_assets WHERE path = ?").bind(data.path).run();
    return { ok: true };
  });

/* ------------------------------------------------------------- analytics */

export const getAnalytics = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ days: z.number().int().min(1).max(90) }).parse(input))
  .handler(async ({ data }): Promise<AnalyticsSummary> => {
    await checkAuth();
    const db = await getDb();
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    const { results } = await db
      .prepare("SELECT path, referrer, visitor_key, created_at FROM pageviews WHERE created_at >= ? ORDER BY created_at DESC LIMIT 20000")
      .bind(since)
      .all<{ path: string; referrer: string | null; visitor_key: string | null; created_at: string }>();

    const views = results || [];
    const dayBuckets = new Map<string, { views: number; visitors: Set<string> }>();
    for (let i = data.days - 1; i >= 0; i--) {
      const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      dayBuckets.set(key, { views: 0, visitors: new Set() });
    }

    const pathCounts = new Map<string, number>();
    const referrerCounts = new Map<string, number>();
    const uniqueVisitors = new Set<string>();
    const dayAgo = Date.now() - 86400000;
    let last24h = 0;

    for (const row of views) {
      const day = row.created_at.slice(0, 10);
      const bucket = dayBuckets.get(day);
      if (bucket) {
        bucket.views += 1;
        if (row.visitor_key) bucket.visitors.add(row.visitor_key);
      }
      if (row.visitor_key) uniqueVisitors.add(row.visitor_key);
      if (new Date(row.created_at).getTime() >= dayAgo) last24h += 1;
      pathCounts.set(row.path, (pathCounts.get(row.path) ?? 0) + 1);
      const referrer = row.referrer ? new URL(row.referrer, "https://x.dev").hostname : "direct";
      referrerCounts.set(referrer, (referrerCounts.get(referrer) ?? 0) + 1);
    }

    const rank = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      totalViews: views.length,
      uniqueVisitors: uniqueVisitors.size,
      last24h,
      daily: [...dayBuckets.entries()].map(([date, bucket]) => ({
        date,
        views: bucket.views,
        visitors: bucket.visitors.size,
      })),
      topPaths: rank(pathCounts).map(([path, count]) => ({ path, views: count })),
      topReferrers: rank(referrerCounts).map(([referrer, count]) => ({ referrer, views: count })),
    };
  });