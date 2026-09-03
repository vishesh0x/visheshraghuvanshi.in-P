import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Container, PageHeader, Tag } from "@/components/site/primitives";
import { SiteShell } from "@/components/site/site-shell";
import { pageMetaQuery, projectsQuery, siteConfigQuery } from "@/lib/cms/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/")({
  loader: async ({ context }) => {
    const [, , meta] = await Promise.all([
      context.queryClient.ensureQueryData(siteConfigQuery()),
      context.queryClient.ensureQueryData(projectsQuery()),
      context.queryClient.ensureQueryData(pageMetaQuery()),
    ]);
    return { meta: meta.projects };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.meta.title ?? "Projects" },
      { name: "description", content: loaderData?.meta.description ?? "" },
      { property: "og:title", content: loaderData?.meta.title ?? "Projects" },
      { property: "og:description", content: loaderData?.meta.description ?? "" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: config } = useSuspenseQuery(siteConfigQuery());
  const { data: projects } = useSuspenseQuery(projectsQuery());
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useMemo(
    () => [...new Set(projects.flatMap((project) => project.tags))].sort(),
    [projects],
  );
  const visible = activeTag
    ? projects.filter((project) => project.tags.includes(activeTag))
    : projects;

  return (
    <SiteShell config={config}>
      <PageHeader
        eyebrow="Directory / 01"
        title="Projects"
        description="Every shipped system, indexed. Filter by stack, open a record for the full build log."
      />

      <div className="border-b border-border">
        <Container className="flex flex-wrap items-center gap-2 bg-background py-3">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={cn(
              "label-mono px-4 py-3 transition-colors",
              activeTag === null
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            All ({projects.length})
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={cn(
                "label-mono px-4 py-3 transition-colors",
                activeTag === tag
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {tag}
            </button>
          ))}
        </Container>
      </div>

      <Container className="py-12 sm:py-16">
        {visible.length === 0 ? (
          <p className="label-mono text-muted-foreground">No records match this filter.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((project, index) => (
              <Link
                key={project.id}
                to="/projects/$slug"
                params={{ slug: project.slug }}
                className="group flex flex-col border border-border bg-background transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="label-mono text-signal">
                    {String(index + 1).padStart(3, "0")}
                  </span>
                  <span className="label-mono text-muted-foreground">{project.year}</span>
                </div>
                {project.cover_url ? (
                  <img
                    src={project.cover_url}
                    alt={`${project.title} cover`}
                    loading="lazy"
                    width={1200}
                    height={900}
                    className="aspect-[4/3] w-full border-b border-border object-cover"
                  />
                ) : null}
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-mono text-lg tracking-tight text-foreground">
                    {project.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {project.summary}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </SiteShell>
  );
}
