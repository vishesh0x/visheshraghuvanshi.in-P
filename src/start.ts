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
 * NOTE: src/server.ts is NOT part of the production build (nothing imports it),
 * so headers must live here - middleware in this file is what actually runs.
 *
 * CSP notes: TanStack Start streams inline hydration scripts, so `script-src`
 * needs 'unsafe-inline' unless nonces are wired through. The policy is still
 * worth having: it blocks framing (clickjacking), plugins, <base> hijacking,
 * form posts to other origins and, via connect-src, most data exfiltration.
 * img-src allows https: because cover/now images may be hosted elsewhere.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": CSP,
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "cross-origin-opener-policy": "same-origin",
};

function applySecurityHeaders(response: Response, pathname: string): Response {
  const patch = (headers: Headers) => {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      // A route (e.g. /api/media) may already set a stricter value of its own.
      if (!headers.has(key)) headers.set(key, value);
    }
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