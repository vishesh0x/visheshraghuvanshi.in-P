import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { AdminPage, EmptyState, StatCard } from "@/components/admin/ui";
import { getOverview } from "@/lib/cms/admin.functions";
import type { ContactMessage } from "@/lib/cms/types";

export const Route = createFileRoute("/admin/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getOverview(),
  });

  return (
    <AdminPage
      title="Overview"
      description="System state at a glance: content volume, inbox pressure and traffic for the last seven days."
    >
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Projects"
          value={isLoading ? "-" : data?.projectCount ?? 0}
          meta={`${data?.publishedCount ?? 0} published`}
        />
        <StatCard label="Now entries" value={isLoading ? "-" : data?.nowCount ?? 0} meta="Live" />
        <StatCard
          label="Inbox"
          value={isLoading ? "-" : data?.messageCount ?? 0}
          meta={`${data?.unreadCount ?? 0} unread`}
        />
        <StatCard
          label="Views / 7d"
          value={isLoading ? "-" : data?.weeklyViews ?? 0}
          meta="Cookieless"
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_260px]">
        <section>
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <h2 className="label-mono text-foreground">Recent messages</h2>
            <Link to="/admin/inbox" className="label-mono text-muted-foreground hover:text-signal">
              Open inbox →
            </Link>
          </div>
          <div className="mt-px divide-y divide-border border-x border-b border-border">
            {(data?.recentMessages ?? []).map((message: ContactMessage) => (
              <div key={message.id} className="px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm text-foreground">{message.subject}</p>
                  <span className="label-mono text-muted-foreground">
                    {new Date(message.created_at).toISOString().slice(0, 10)}
                  </span>
                </div>
                <p className="label-mono mt-2 text-signal">
                  {message.name} · {message.email}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{message.message}</p>
              </div>
            ))}
            {!isLoading && (data?.recentMessages.length ?? 0) === 0 ? (
              <div className="px-4 py-8">
                <EmptyState message="No messages yet." />
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="label-mono border-b border-border pb-3 text-foreground">Quick actions</h2>
          <div className="mt-px flex flex-col border-x border-b border-border">
            {[
              { to: "/admin/projects", label: "New project" },
              { to: "/admin/now", label: "Update now board" },
              { to: "/admin/resume", label: "Arrange resume" },
              { to: "/admin/media", label: "Upload asset" },
              { to: "/admin/site", label: "Edit site config" },
            ].map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="label-mono border-b border-border px-4 py-3.5 text-muted-foreground last:border-b-0 hover:bg-accent hover:text-foreground"
              >
                {action.label} →
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminPage>
  );
}
