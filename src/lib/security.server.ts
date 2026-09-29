/**
 * SERVER-ONLY security helpers. Never import from client code.
 */
import { FilterXSS, escapeAttrValue, safeAttrValue as defaultSafeAttrValue } from "xss";

import { getCloudflareEnv } from "@/lib/db/d1.server";

/* ------------------------------------------------------------------ HTML */

/**
 * Allow-list sanitizer for admin-authored rich text (project bodies, legal
 * pages) that is later rendered with dangerouslySetInnerHTML.
 *
 * The editor (Tiptap StarterKit + Link) only ever emits the tags below, so
 * nothing legitimate is lost. Everything else - <script>, <iframe>, <style>,
 * event-handler attributes, javascript:/data: URLs - is removed, so a
 * compromised admin session, a poisoned paste, or a direct server-function
 * call can't turn stored content into script running on the public site.
 */
const sanitizer = new FilterXSS({
  whiteList: {
    p: [],
    br: [],
    hr: [],
    strong: [],
    b: [],
    em: [],
    i: [],
    u: [],
    s: [],
    code: [],
    pre: [],
    blockquote: [],
    h2: [],
    h3: [],
    h4: [],
    ul: [],
    ol: [],
    li: [],
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "title", "width", "height", "loading"],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
  css: false, // drop style="" attributes entirely
  safeAttrValue(tag, name, value, cssFilter) {
    if (name === "href" || name === "src") {
      const v = value.trim();
      const ok =
        /^https?:\/\//i.test(v) ||
        (tag === "a" && /^mailto:/i.test(v)) ||
        (v.startsWith("/") && !v.startsWith("//")) ||
        v.startsWith("#");
      return ok ? escapeAttrValue(v) : "";
    }
    return defaultSafeAttrValue(tag, name, value, cssFilter);
  },
  onTagAttr(tag, name, value) {
    // Force safe link behaviour on every anchor that opens a new tab.
    if (tag === "a" && name === "target" && value !== "_blank") return "";
    return undefined;
  },
});

export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  const clean = sanitizer.process(html);
  // Anchors that open a new tab must never leak window.opener.
  return clean.replace(/<a\b([^>]*?)>/gi, (match, attrs: string) => {
    if (/target="_blank"/i.test(attrs)) {
      const withoutRel = attrs.replace(/\srel="[^"]*"/i, "");
      return `<a${withoutRel} rel="noopener noreferrer">`;
    }
    return match;
  });
}

/* ----------------------------------------------------------- keyed hashes */

function secret(): string {
  const env = getCloudflareEnv();
  const value = env["ADMIN_SESSION_SECRET"] || process.env["ADMIN_SESSION_SECRET"];
  if (!value || typeof value !== "string") {
    throw new Error("ADMIN_SESSION_SECRET is not configured.");
  }
  return value;
}

/**
 * Keyed (HMAC-SHA256) 128-bit identifier, used for the rate-limit key and the
 * daily anonymous visitor key.
 *
 * A plain SHA-256 of "ip|<constant from the public repo>" can be reversed by
 * hashing all ~4 billion IPv4 addresses in minutes, which contradicts the
 * "non-reversible identifier" wording in the privacy policy. Keying the hash
 * with a secret only this deployment knows makes that guarantee true.
 */
export async function keyedHash(purpose: string, ...parts: string[]): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${purpose}\u0000${parts.join("\u0000")}`));
  return Array.from(new Uint8Array(sig))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------------------------------------------------------- file signatures */

const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  "image/png": (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  "image/gif": (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]),
  "image/webp": (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && ascii(b, 8, 12) === "WEBP",
  "image/avif": (b) => ascii(b, 4, 8) === "ftyp" && /avif|avis/.test(ascii(b, 8, 16)),
  "image/x-icon": (b) => startsWith(b, [0x00, 0x00, 0x01, 0x00]),
  "image/vnd.microsoft.icon": (b) => startsWith(b, [0x00, 0x00, 0x01, 0x00]),
  "application/pdf": (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]),
};

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  return sig.every((v, i) => bytes[i] === v);
}
function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

/** True when the file's real leading bytes match the MIME type the client claimed. */
export function matchesDeclaredType(mime: string, bytes: Uint8Array): boolean {
  const check = SIGNATURES[mime];
  return check ? check(bytes) : false;
}
