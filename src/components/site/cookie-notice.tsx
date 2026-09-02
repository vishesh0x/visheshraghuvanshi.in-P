import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const STORAGE_KEY = "privacy-notice-dismissed-v1";

/**
 * This site's own analytics beacon sets no cookies (see src/components/site/site-shell.tsx
 * and src/lib/cms/public.functions.ts trackPageview). This notice exists purely for
 * transparency about the contact form (Cloudflare Turnstile) and Google Fonts requests,
 * and to link to the privacy policy - it does not gate any tracking script, because
 * none runs before consent here.
 */
export function CookieNotice() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(false);
    }
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) return null;
  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage may be unavailable (private browsing); still hide for this session.
    }
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Privacy notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/97 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          This site uses a cookie-free, first-party pageview beacon - no tracking cookies, no ad
          pixels. The contact form uses Cloudflare Turnstile for spam protection when enabled. See
          the{" "}
          <Link to="/privacy" className="text-foreground underline underline-offset-2">
            privacy policy
          </Link>{" "}
          for details.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="label-mono shrink-0 border border-border px-4 py-2 text-foreground transition-colors hover:bg-accent"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
