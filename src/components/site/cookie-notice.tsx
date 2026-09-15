import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(false);
    }
  }, []);

  const hiddenRoute = pathname.startsWith("/admin") || pathname.startsWith("/auth");
  const showing = visible && !hiddenRoute;

  // Being `fixed` takes this out of document flow, so on narrow viewports -
  // where the text wraps to 2-3 lines and the banner is noticeably taller -
  // it can sit directly on top of whatever's at the bottom of the page for
  // a first-time visitor. Reserve exactly as much space as it actually
  // renders at (not a guessed fixed height, since that varies by viewport
  // width) so nothing is ever hidden behind it, and release it on dismiss.
  useEffect(() => {
    if (!showing) return;
    const el = noticeRef.current;
    if (!el) return;

    const apply = () => {
      document.body.style.paddingBottom = `${el.offsetHeight}px`;
    };
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, [showing]);

  if (!showing) return null;

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
      ref={noticeRef}
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
