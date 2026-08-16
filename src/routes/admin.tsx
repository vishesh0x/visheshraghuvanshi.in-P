import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { getAdminAuthSession, signOutAdminAction } from "@/lib/auth/admin-auth";
import { getAdminSession } from "@/lib/cms/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Control OS" },
      { name: "description", content: "Administer site content, resume, media, inbox and analytics." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Control OS" },
      { property: "og:description", content: "Administer content, resume, media, inbox, analytics." },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/site", label: "Site config", exact: false },
  { to: "/admin/seo", label: "SEO", exact: false },
  { to: "/admin/projects", label: "Projects", exact: false },
  { to: "/admin/now", label: "Now board", exact: false },
  { to: "/admin/resume", label: "Resume builder", exact: false },
  { to: "/admin/media", label: "Assets", exact: false },
  { to: "/admin/inbox", label: "Inbox", exact: false },
  { to: "/admin/analytics", label: "Analytics", exact: false },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let active = true;
    void getAdminAuthSession().then((session) => {
      if (!active) return;
      setAuthed(session.authenticated);
      setChecked(true);
      if (!session.authenticated) void navigate({ to: "/auth" });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const session = useQuery({
    queryKey: ["admin-session"],
    queryFn: () => getAdminSession(),
    enabled: authed,
    retry: false,
  });

  if (!checked || !authed) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background">
        <p className="label-mono text-muted-foreground">Verifying operator…</p>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-border lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <span className="flex h-7 w-7 items-center justify-center bg-signal font-mono text-[11px] font-bold text-signal-foreground">
              OS
            </span>
            <span className="label-mono text-foreground">Control</span>
          </div>

          <nav className="flex flex-wrap lg:block">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "label-mono block border-b border-border px-5 py-3.5 transition-colors",
                    active
                      ? "bg-signal text-signal-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-5 py-4">
            <p className="label-mono text-muted-foreground">Operator</p>
            <p className="mt-2 break-all font-mono text-[11px] text-foreground">
              {session.data?.email ?? "admin@local"}
            </p>
            <p className="label-mono mt-2 text-signal">
              {session.data?.isAdmin ? "Admin" : session.isLoading ? "…" : "Read-only"}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/" className="label-mono text-muted-foreground hover:text-signal">
                ← Public site
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await signOutAdminAction();
                  void navigate({ to: "/auth" });
                }}
                className="label-mono text-left text-muted-foreground hover:text-destructive"
              >
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10">
          {session.data && !session.data.isAdmin ? (
            <div className="mb-8 border border-destructive px-4 py-3">
              <p className="label-mono text-destructive">
                This account has no admin role - changes will be rejected.
              </p>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
