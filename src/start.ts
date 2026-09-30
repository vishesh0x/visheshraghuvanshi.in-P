import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { getRouter } from "./router"; // <-- Add this import

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Baseline security headers for every response (SSR pages, server functions and
 * API routes all pass through request middleware).
 *
 * Script policy: every HTML response gets a fresh random nonce, stamped onto
 * every <script> by Cloudflare's streaming HTMLRewriter (this also covers the
 * inline hydration scripts TanStack Start streams in later), and script-src
 * allows only that nonce, same-origin files and Turnstile. There is NO
 * 'unsafe-inline' for scripts, so an injected <script> or onerror= handler can't
 * run even if HTML sanitisation were ever bypassed.
 * If HTMLRewriter isn't available (plain Node, e.g. `vite dev`) it falls back to
 * 'unsafe-inline' so development keeps working.
 *
 * Styles keep 'unsafe-inline': React sets style="" attributes and Tailwind/Recharts
 * emit inline styles; that is a much lower-risk sink than scripts.
 * img-src allows https: because cover/now images may be hosted elsewhere.
 *
 * NOTE: nothing imports src/server.ts, so headers must live in this middleware.
 */
function buildCsp(nonce: string | null): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : "'unsafe-inline'"} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "cross-origin-opener-policy": "same-origin",
};

function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function applySecurityHeaders(input: Response, pathname: string): Response {
  const isHtml = (input.headers.get("content-type") ?? "").includes("text/html");
  const rewriterAvailable =
    typeof (globalThis as { HTMLRewriter?: unknown }).HTMLRewriter !== "undefined";

  let response = input;
  let nonce: string | null = null;
  if (isHtml && rewriterAvailable) {
    nonce = newNonce();
    const value = nonce;
    const Rewriter = (globalThis as unknown as { HTMLRewriter: new () => any }).HTMLRewriter;
    response = new Rewriter()
      .on("script", {
        element(el: { setAttribute(name: string, v: string): void }) {
          el.setAttribute("nonce", value);
        },
      })
      .transform(input) as Response;
  }

  const patch = (headers: Headers) => {
    for (const [key, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
      // A route (e.g. /api/media) may already set a stricter value of its own.
      if (!headers.has(key)) headers.set(key, value);
    }
    if (!headers.has("content-security-policy")) headers.set("content-security-policy", buildCsp(nonce));
    // A nonce is only meaningful if it is never reused: keep shared caches away.
    if (nonce) headers.set("cache-control", "private, no-cache");
    // Never let shared caches store the dashboard, login or RPC responses.
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/_serverFn")
    ) {
      headers.set("cache-control", "no-store");
      headers.set("x-robots-tag", "noindex, nofollow");
    }
  };

  try {
    patch(response.headers);
    return response;
  } catch {
    // Some responses (e.g. Response.redirect) have immutable headers - copy them.
    const headers = new Headers(response.headers);
    patch(headers);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

const securityHeadersMiddleware = createMiddleware().server(async ({ next, pathname }) => {
  const result = (await next()) as unknown;
  if (result instanceof Response) return applySecurityHeaders(result, pathname) as never;
  const wrapped = result as { response?: unknown };
  if (wrapped?.response instanceof Response) {
    wrapped.response = applySecurityHeaders(wrapped.response, pathname);
  }
  return result as never;
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  getRouter, // <-- Add getRouter here!
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware, csrfMiddleware],
}));