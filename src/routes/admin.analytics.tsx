import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AdminPage, EmptyState, StatCard } from "@/components/admin/ui";
import { getAnalytics } from "@/lib/cms/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

const RANGES = [7, 30, 90] as const;

function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", days],
    queryFn: () => getAnalytics({ data: { days } }),
  });

  return (
    <AdminPage
      title="Analytics"
      description="Cookieless, self-hosted traffic. Visitors are counted with a salted daily hash that is never reversible."
      actions={
        <div className="flex gap-px bg-border">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDays(range)}
              className={cn(
                "label-mono px-4 py-2.5 transition-colors",
                days === range
                  ? "bg-signal text-signal-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {range}d
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
        <StatCard label="Pageviews" value={isLoading ? "-" : data?.totalViews ?? 0} />
        <StatCard label="Unique visitors" value={isLoading ? "-" : data?.uniqueVisitors ?? 0} />
        <StatCard label="Last 24h" value={isLoading ? "-" : data?.last24h ?? 0} />
      </div>

      <section className="mt-10 border border-border bg-card p-4">
        <p className="label-mono text-muted-foreground">Traffic</p>
        <div className="mt-6 h-64">
          {data && data.daily.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--signal)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--signal)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickFormatter={(value: string) => value.slice(5)}
                  stroke="var(--border)"
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  stroke="var(--border)"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 0,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="var(--signal)"
                  strokeWidth={1.5}
                  fill="url(#views)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="label-mono text-muted-foreground">
                {isLoading ? "Loading…" : "No traffic recorded yet."}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {[
          { title: "Top pages", rows: data?.topPaths.map((r) => [r.path, r.views] as const) ?? [] },
          {
            title: "Top referrers",
            rows: data?.topReferrers.map((r) => [r.referrer, r.views] as const) ?? [],
          },
        ].map((table) => (
          <section key={table.title}>
            <h2 className="label-mono border-b border-border pb-3 text-foreground">
              {table.title}
            </h2>
            {table.rows.length === 0 ? (
              <div className="mt-4">
                <EmptyState message="No data in this range." />
              </div>
            ) : (
              <div className="divide-y divide-border border-x border-b border-border">
                {table.rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="truncate font-mono text-xs text-foreground">{label}</span>
                    <span className="label-mono text-signal">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </AdminPage>
  );
}
