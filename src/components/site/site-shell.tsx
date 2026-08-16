import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { trackPageview } from "@/lib/cms/public.functions";
import type { SiteConfig } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Index" },
  { to: "/projects", label: "Projects" },
  { to: "/now", label: "Now" },
  { to: "/resume", label: "Resume" },
  { to: "/contact", label: "Contact" },
] as const;

function useClock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
        }),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

/** Fires one privacy-safe pageview per route change. No cookies, no fingerprints. */
function usePageviewBeacon() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const referrer = typeof document === "undefined" ? "" : document.referrer;
    void trackPageview({ data: { path: pathname, referrer } }).catch(() => undefined);
  }, [pathname]);
}

export function SiteShell({ config, children }: { config: SiteConfig; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const clock = useClock();
  usePageviewBeacon();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center bg-foreground font-mono text-[11px] font-bold text-background">
              {config.initials.slice(0, 2)}
            </span>
            <span className="label-mono hidden text-foreground sm:inline">{config.system_name}</span>
          </Link>

          <nav className="hidden items-center md:flex">
            {NAV.map((item) => {
              const active =
                item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "label-mono border-l border-border px-4 py-[18px] transition-colors last:border-r",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <span className="label-mono hidden text-muted-foreground lg:inline">
              UTC {clock ?? "--:--:--"}
            </span>
            <button
              type="button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="label-mono border border-border px-3 py-2 text-foreground md:hidden"
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t border-border md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="label-mono block border-b border-border px-6 py-4 text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main>{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-background p-6">
            <p className="label-mono text-muted-foreground">Operator</p>
            <p className="mt-3 text-sm text-foreground">{config.owner_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{config.location}</p>
          </div>
          <div className="bg-background p-6">
            <p className="label-mono text-muted-foreground">Direct</p>
            <a
              href={`mailto:${config.contact_email}`}
              className="mt-3 block text-sm text-foreground underline decoration-border underline-offset-4 hover:decoration-signal"
            >
              {config.contact_email}
            </a>
          </div>
          <div className="bg-background p-6">
            <p className="label-mono text-muted-foreground">Elsewhere</p>
            <ul className="mt-3 space-y-1">
              {config.socials.map((social) => (
                <li key={social.url}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm text-foreground hover:text-signal"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
              {config.socials.length === 0 ? (
                <li className="text-sm text-muted-foreground">-</li>
              ) : null}
            </ul>
          </div>
          <div className="bg-background p-6">
            <p className="label-mono text-muted-foreground">Build</p>
            <p className="mt-3 font-mono text-sm text-foreground">v{config.build_version}</p>
            <Link to="/admin" className="label-mono mt-3 inline-block text-muted-foreground hover:text-signal">
              Control dashboard →
            </Link>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-6 py-4">
            <p className="label-mono text-muted-foreground">
              © {new Date().getFullYear()} {config.owner_name}
            </p>
            <p className="label-mono text-muted-foreground">Self-hosted · Edge-powered</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
