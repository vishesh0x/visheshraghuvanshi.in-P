import { z } from "zod";

/**
 * CMS domain contracts.
 *
 * These types are the boundary between the UI and the data layer. The data
 * layer (src/lib/cms/*.functions.ts) is the only place that knows which
 * backend is in use, so swapping Postgres for D1/R2 later means rewriting the
 * function bodies and nothing else.
 */

export const socialLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: z.string().trim().url().max(300),
});
export type SocialLink = z.infer<typeof socialLinkSchema>;

export const siteConfigSchema = z.object({
  id: z.string(),
  owner_name: z.string().trim().min(1).max(80),
  initials: z.string().trim().min(1).max(6),
  system_name: z.string().trim().min(1).max(60),
  status: z.string().trim().max(60),
  location: z.string().trim().max(80),
  hero_line_one: z.string().trim().max(120),
  hero_line_two: z.string().trim().max(120),
  bio: z.string().trim().max(2000),
  contact_email: z.string().trim().email().max(160),
  meta_description: z.string().trim().max(300),
  build_version: z.string().trim().max(40),
  resume_pdf_url: z.string().trim().max(500).nullable(),
  socials: z.array(socialLinkSchema),
  site_title: z.string().trim().min(1).max(120),
  favicon_url: z.string().trim().max(500).nullable(),
  now_categories: z.array(z.string().trim().min(1).max(32)),
  updated_at: z.string(),
});
export type SiteConfig = z.infer<typeof siteConfigSchema>;

export const siteConfigInputSchema = siteConfigSchema.omit({
  id: true,
  updated_at: true,
});
export type SiteConfigInput = z.infer<typeof siteConfigInputSchema>;

export const projectSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  cover_url: z.string().nullable(),
  live_url: z.string().nullable(),
  source_url: z.string().nullable(),
  tags: z.array(z.string()),
  year: z.number(),
  featured: z.boolean(),
  published: z.boolean(),
  sort_order: z.number(),
  meta_title: z.string().nullable(),
  meta_description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

const slugField = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/.+/.test(v) || v.startsWith("/"), "Must be a URL")
  .transform((v) => (v === "" ? null : v))
  .nullable();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const projectInputSchema = z.object({
  slug: slugField,
  title: z.string().trim().min(1, "Title is required").max(140),
  summary: z.string().trim().max(400),
  body: z.string().max(60000),
  cover_url: optionalUrl,
  live_url: optionalUrl,
  source_url: optionalUrl,
  tags: z.array(z.string().trim().min(1).max(32)).max(12),
  year: z.number().int().min(1970).max(2200),
  featured: z.boolean(),
  published: z.boolean(),
  sort_order: z.number().int().min(0).max(10000),
  meta_title: optionalText(140),
  meta_description: optionalText(300),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const pageMetaSchema = z.object({
  page_key: z.string(),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(300),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

export const PAGE_META_KEYS = ["home", "projects", "resume", "now", "contact"] as const;
export type PageMetaKey = (typeof PAGE_META_KEYS)[number];

export const pageMetaInputSchema = z.object({
  page_key: z.enum(PAGE_META_KEYS),
  title: z.string().trim().min(1, "Title is required").max(140),
  description: z.string().trim().min(1, "Description is required").max(300),
});
export type PageMetaInput = z.infer<typeof pageMetaInputSchema>;

export const faqItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  published: z.boolean(),
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

export const faqItemInputSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(200),
  answer: z.string().trim().min(1, "Answer is required").max(2000),
  published: z.boolean(),
  sort_order: z.number().int().min(0).max(10000),
});
export type FaqItemInput = z.infer<typeof faqItemInputSchema>;

export const LEGAL_PAGE_KEYS = ["privacy", "terms"] as const;
export type LegalPageKey = (typeof LEGAL_PAGE_KEYS)[number];

export const legalPageSchema = z.object({
  page_key: z.enum(LEGAL_PAGE_KEYS),
  title: z.string(),
  body_html: z.string(),
});
export type LegalPage = z.infer<typeof legalPageSchema>;

export const legalPageInputSchema = z.object({
  page_key: z.enum(LEGAL_PAGE_KEYS),
  title: z.string().trim().min(1, "Title is required").max(140),
  body_html: z.string().max(60000),
});
export type LegalPageInput = z.infer<typeof legalPageInputSchema>;

export const NOW_CATEGORIES = ["building", "reading", "learning", "listening", "shipping"] as const;

export const nowItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  image_url: z.string().nullable(),
  link_url: z.string().nullable(),
  published: z.boolean(),
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type NowItem = z.infer<typeof nowItemSchema>;

export const nowItemInputSchema = z.object({
  category: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1, "Title is required").max(140),
  description: z.string().trim().max(600),
  image_url: optionalUrl,
  link_url: optionalUrl,
  published: z.boolean(),
  sort_order: z.number().int().min(0).max(10000),
});
export type NowItemInput = z.infer<typeof nowItemInputSchema>;


export const resumeEntrySchema = z.object({
  id: z.string(),
  section_id: z.string(),
  role: z.string(),
  organization: z.string(),
  location: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  description: z.string(),
  bullets: z.array(z.string()),
  hidden: z.boolean(),
  sort_order: z.number(),
});
export type ResumeEntry = z.infer<typeof resumeEntrySchema>;

export const resumeSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  hidden: z.boolean(),
  sort_order: z.number(),
});
export type ResumeSection = z.infer<typeof resumeSectionSchema>;

export type ResumeSectionWithEntries = ResumeSection & { entries: ResumeEntry[] };

export const resumeEntryInputSchema = z.object({
  section_id: z.string().min(1),
  role: z.string().trim().min(1, "Role is required").max(140),
  organization: z.string().trim().max(140),
  location: z.string().trim().max(120),
  start_date: z.string().trim().max(40),
  end_date: z.string().trim().max(40),
  description: z.string().trim().max(2000),
  bullets: z.array(z.string().trim().max(400)).max(20),
  hidden: z.boolean(),
  sort_order: z.number().int().min(0).max(10000).optional(),
});
export type ResumeEntryInput = z.infer<typeof resumeEntryInputSchema>;

export const contactMessageSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  subject: z.string(),
  message: z.string(),
  is_read: z.boolean(),
  is_starred: z.boolean(),
  country: z.string().nullable(),
  created_at: z.string(),
});
export type ContactMessage = z.infer<typeof contactMessageSchema>;

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  subject: z.string().trim().min(1, "Subject is required").max(160),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(4000),
  token: z.string().max(4000).optional(),
});
export type ContactInput = z.infer<typeof contactInputSchema>;

export type MediaAsset = {
  id: string;
  name: string;
  path: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type AnalyticsSummary = {
  totalViews: number;
  uniqueVisitors: number;
  last24h: number;
  daily: { date: string; views: number; visitors: number }[];
  topPaths: { path: string; views: number }[];
  topReferrers: { referrer: string; views: number }[];
};
