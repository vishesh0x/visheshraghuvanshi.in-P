import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Container, PageHeader } from "@/components/site/primitives";
import { ObfuscatedMailLink } from "@/components/site/obfuscated-mail-link";
import { SiteShell } from "@/components/site/site-shell";
import { pageMetaQuery, siteConfigQuery } from "@/lib/cms/queries";
import { contactInputSchema } from "@/lib/cms/types";

export const Route = createFileRoute("/contact")({
  loader: async ({ context }) => {
    const [, meta] = await Promise.all([
      context.queryClient.ensureQueryData(siteConfigQuery()),
      context.queryClient.ensureQueryData(pageMetaQuery()),
    ]);
    return { meta: meta.contact };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.meta.title ?? "Contact" },
      { name: "description", content: loaderData?.meta.description ?? "" },
      { property: "og:title", content: loaderData?.meta.title ?? "Contact" },
      { property: "og:description", content: loaderData?.meta.description ?? "" },
    ],
  }),
  component: ContactPage,
});

const TURNSTILE_SITE_KEY = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;

type FieldErrors = Partial<Record<"name" | "email" | "subject" | "message", string>>;

type TurnstileApi = {
  render: (el: Element, o: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
};

function getTurnstile(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

/**
 * Turnstile tokens are single-use. After ANY submit attempt (success, validation
 * error, rate limit) the token is spent, so the widget must be reset - otherwise
 * every retry is rejected with "Verification failed" until the page is reloaded.
 * Bump `resetSignal` after each attempt to get a fresh challenge.
 */
function TurnstileWidget({
  onToken,
  resetSignal,
}: {
  onToken: (token: string) => void;
  resetSignal: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const scriptId = "cf-turnstile-script";
    const render = () => {
      const api = getTurnstile();
      if (api && ref.current && widgetId.current === null) {
        widgetId.current = api.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      }
    };
    if (document.getElementById(scriptId)) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [onToken]);

  useEffect(() => {
    if (resetSignal === 0 || widgetId.current === null) return;
    getTurnstile()?.reset(widgetId.current);
  }, [resetSignal]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="mt-2" />;
}

function ContactPage() {
  const { data: config } = useSuspenseQuery(siteConfigQuery());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    // Honeypot: a field real visitors never see or fill in. Bots that blindly fill
    // every input trip this, so we quietly "succeed" without ever hitting the server.
    if (String(form.get("company") ?? "").trim().length > 0) {
      setSent(true);
      return;
    }

    const parsed = contactInputSchema.safeParse({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      subject: String(form.get("subject") ?? ""),
      message: String(form.get("message") ?? ""),
      token,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      // Move focus to the first invalid field so keyboard and screen-reader
      // users land where the problem is instead of hunting for it.
      const first = (["name", "email", "subject", "message"] as const).find((key) => next[key]);
      if (first) formRef.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
      return;
    }

    if (TURNSTILE_SITE_KEY && !token) {
      toast.error("Please complete the verification check first.");
      return;
    }

    setErrors({});
    setPending(true);
    try {
      // Goes straight to the real HTTP endpoint (not a server-function RPC
      // call) so a rate-limit hit comes back as a genuine 429 status the
      // client can actually branch on, instead of a 200 with an error field.
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok?: false; error?: string }
        | null;

      if (response.ok && result?.ok) {
        setSent(true);
        toast.success("Message delivered to the inbox.");
      } else if (response.status === 429) {
        toast.error(result?.error ?? "Too many requests. Please try again later.");
      } else {
        toast.error(result?.error ?? "Could not send message. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPending(false);
      if (TURNSTILE_SITE_KEY) {
        setToken("");
        setTurnstileReset((n) => n + 1);
      }
    }
  }

  const fieldClass =
    "mt-2 w-full border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-signal";

  return (
    <SiteShell config={config}>
      <PageHeader
        crumbs={[{ label: "Home", to: "/" }, { label: "Contact" }]}
        eyebrow="Channel / 04"
        title="Contact"
        description="Messages land directly in the admin inbox - no third-party form service, no tracking pixels."
      />

      <Container className="grid gap-12 py-12 lg:grid-cols-[1fr_300px] sm:py-16">
        <div>
          {sent ? (
            <div className="border border-border p-8" role="status" aria-live="polite">
              <p className="label-mono text-signal">Transmission complete</p>
              <h2 className="mt-4 font-mono text-xl text-foreground">Message received</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Thanks - it's queued in the inbox and I'll reply from {config.contact_email}.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="label-mono mt-6 border border-border px-4 py-2.5 text-foreground hover:bg-accent"
              >
                Send another
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="max-w-xl">
              {/* Honeypot field - hidden from sighted and screen-reader users, bots fill it anyway. */}
              <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
                <label htmlFor="company">Company</label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="label-mono text-muted-foreground">
                    Name
                  </label>
                  <input id="name" name="name" maxLength={100} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} className={fieldClass} />
                  {errors.name ? (
                    <p id="name-error" role="alert" className="label-mono mt-2 text-destructive">{errors.name}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="email" className="label-mono text-muted-foreground">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    maxLength={255}
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className={fieldClass}
                  />
                  {errors.email ? (
                    <p id="email-error" role="alert" className="label-mono mt-2 text-destructive">{errors.email}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="subject" className="label-mono text-muted-foreground">
                  Subject
                </label>
                <input id="subject" name="subject" maxLength={160} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? "subject-error" : undefined} className={fieldClass} />
                {errors.subject ? (
                  <p id="subject-error" role="alert" className="label-mono mt-2 text-destructive">{errors.subject}</p>
                ) : null}
              </div>

              <div className="mt-6">
                <label htmlFor="message" className="label-mono text-muted-foreground">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={8}
                  maxLength={4000}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? "message-error" : undefined}
                  className={`${fieldClass} resize-y leading-relaxed`}
                />
                {errors.message ? (
                  <p id="message-error" role="alert" className="label-mono mt-2 text-destructive">{errors.message}</p>
                ) : null}
              </div>

              <TurnstileWidget onToken={setToken} resetSignal={turnstileReset} />

              <button
                type="submit"
                disabled={pending}
                className="label-mono mt-8 bg-foreground px-6 py-4 text-background transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {pending ? "Transmitting…" : "Send message →"}
              </button>
            </form>
          )}
        </div>

        <aside className="self-start border border-border">
          <div className="border-b border-border px-4 py-3">
            <p className="label-mono text-muted-foreground">Direct routes</p>
          </div>
          <div className="divide-y divide-border">
            <ObfuscatedMailLink
              email={config.contact_email}
              className="block px-4 py-4 hover:bg-accent"
              label="Email"
              addressClassName="mt-1.5 font-mono text-xs text-foreground"
            />
            {config.socials.map((social) => (
              <a
                key={social.url}
                href={social.url}
                target="_blank"
                rel="noreferrer noopener"
                className="block px-4 py-4 hover:bg-accent"
              >
                <p className="label-mono text-muted-foreground">{social.label}</p>
                <p className="mt-1.5 font-mono text-xs text-foreground">Open ↗</p>
              </a>
            ))}
          </div>
        </aside>
      </Container>
    </SiteShell>
  );
}
