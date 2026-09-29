import { createFileRoute } from "@tanstack/react-router";

import { contactInputSchema } from "@/lib/cms/types";
import { CONTACT_RATE_LIMIT, checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/cms/rate-limit.server";
import { getCloudflareEnv, getD1Database } from "@/lib/db/d1.server";

/**
 * Public contact intake endpoint using Cloudflare D1.
 */
export const Route = createFileRoute("/api/public/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
        }

        const parsed = contactInputSchema.safeParse(payload);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          );
        }

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for") ??
          "unknown";
        const country = request.headers.get("cf-ipcountry");

        const env = getCloudflareEnv();
        const turnstileSecret = env["TURNSTILE_SECRET_KEY"] || process.env["TURNSTILE_SECRET_KEY"];
        if (turnstileSecret) {
          const verify = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                secret: turnstileSecret,
                response: parsed.data.token ?? "",
                remoteip: ip,
              }),
            },
          )
            .then((res) => res.json() as Promise<{ success?: boolean }>)
            .catch(() => ({ success: false }));
          if (!verify.success) {
            return Response.json({ ok: false, error: "Verification failed" }, { status: 403 });
          }
        }

        const { keyedHash } = await import("@/lib/security.server");
        const ipHash = await keyedHash("contact-ip", ip);

        try {
          const db = getD1Database();

          const recent = await checkRateLimit(db, "contact_messages", "ip_hash", ipHash, CONTACT_RATE_LIMIT);
          if (!recent.allowed) {
            return Response.json(
              { error: RATE_LIMIT_MESSAGE },
              {
                status: 429,
                headers: { "retry-after": String(recent.retryAfterSeconds) },
              },
            );
          }

          const id = crypto.randomUUID();

          await db
            .prepare(
              "INSERT INTO contact_messages (id, name, email, subject, message, country, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
            )
            .bind(
              id,
              parsed.data.name,
              parsed.data.email,
              parsed.data.subject,
              parsed.data.message,
              country && country !== "XX" ? country : null,
              ipHash,
            )
            .run();

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[api/public/contact]", err);
          return Response.json({ ok: false, error: "Could not store message" }, { status: 500 });
        }
      },
    },
  },
});
