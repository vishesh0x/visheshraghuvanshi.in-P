import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { Container, SectionHeader, Tag } from "@/components/site/primitives";
import { SiteShell } from "@/components/site/site-shell";
import { nowQuery, pageMetaQuery, projectsQuery, siteConfigQuery } from "@/lib/cms/queries";
import { absoluteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const [, , , meta] = await Promise.all([
      context.queryClient.ensureQueryData(siteConfigQuery()),
      context.queryClient.ensureQueryData(projectsQuery()),
      context.queryClient.ensureQueryData(nowQuery()),
      context.queryClient.ensureQueryData(pageMetaQuery()),
    ]);
    return { meta: meta.home };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.meta.title ?? "Portfolio OS" },
      { name: "description", content: loaderData?.meta.description ?? "" },
      { property: "og:title", content: loaderData?.meta.title ?? "Portfolio OS" },
      { property: "og:description", content: loaderData?.meta.description ?? "" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: config } = useSuspenseQuery(siteConfigQuery());
  const { data: projects } = useSuspenseQuery(projectsQuery());
  const { data: nowItems } = useSuspenseQuery(nowQuery());

  const featured = projects.filter((project) => project.featured).slice(0, 3);
  const list = featured.length > 0 ? featured : projects.slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: config.system_name,
        url: absoluteUrl("/"),
        description: config.bio,
      },
      {
        "@type": "Person",
        name: config.owner_name,
        url: absoluteUrl("/"),
        jobTitle: config.hero_line_one,
        email: `mailto:${config.contact_email}`,
        sameAs: config.socials.map((social) => social.url),
      },
    ],
  };

  return (
    <SiteShell config={config}>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero */}
      <section className="border-b border-border grid-paper">
        <Container className="py-16 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 border border-border bg-background px-3 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
                  <span className="label-mono text-foreground">{config.status}</span>
                </span>
                <span className="label-mono text-muted-foreground">{config.location}</span>
              </div>

              <h1 className="mt-8 font-mono text-[2.35rem] leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                {config.hero_line_one}
                <br />
                <span className="text-muted-foreground">{config.hero_line_two}</span>
              </h1>

              <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
                {config.bio}
              </p>

              <div className="mt-10 inline-flex flex-wrap gap-px bg-border">
                <Link
                  to="/projects"
                  className="label-mono bg-foreground px-6 py-4 text-background transition-opacity hover:opacity-85"
                >
                  View projects →
                </Link>
                <Link
                  to="/contact"
                  className="label-mono bg-background px-6 py-4 text-foreground transition-colors hover:bg-accent"
                >
                  Open channel
                </Link>
              </div>
            </div>

            {/* Spec readout */}
            <aside className="self-start border border-border bg-background">
              <div className="border-b border-border px-4 py-3">
                <p className="label-mono text-muted-foreground">System readout</p>
              </div>
              <dl className="divide-y divide-border">
                {[
                  ["Operator", config.owner_name],
                  ["Node", config.location],
                  ["Projects", String(projects.length).padStart(2, "0")],
                  ["Now entries", String(nowItems.length).padStart(2, "0")],
                  ["Build", `v${config.build_version}`],
                ].map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-4 px-4 py-3">
                    <dt className="label-mono text-muted-foreground">{key}</dt>
                    <dd className="font-mono text-xs text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </Container>
      </section>

      {/* Selected work */}
      <section className="border-b border-border">
        <Container className="py-14 sm:py-20">
          <SectionHeader index="01" title="Selected work" meta={`${list.length} entries`} />

          <div className="mt-px grid grid-cols-1 gap-4 md:grid-cols-3">
            {list.map((project, index) => (
              <Link
                key={project.id}
                to="/projects/$slug"
                params={{ slug: project.slug }}
                className="group flex flex-col border border-border bg-background transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="label-mono text-signal">
                    {String(index + 1).padStart(2, "0")}
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
                  <h3 className="font-mono text-lg tracking-tight text-foreground">
                    {project.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {project.summary}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {project.tags.slice(0, 3).map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <Link
            to="/projects"
            className="label-mono mt-8 inline-block border-b border-signal pb-1 text-foreground"
          >
            All projects →
          </Link>
        </Container>
      </section>

      {/* Now board */}
      <section>
        <Container className="py-14 sm:py-20">
          <SectionHeader index="02" title="Now" meta="Live board" />
          <div className="mt-px grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            {nowItems.slice(0, 6).map((item) => (
              <article key={item.id} className="border border-border bg-background p-5">
                <p className="label-mono text-signal">{item.category}</p>
                <h3 className="mt-3 text-base font-medium text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
          <Link
            to="/now"
            className="label-mono mt-8 inline-block border-b border-signal pb-1 text-foreground"
          >
            Full board →
          </Link>
        </Container>
      </section>
    </SiteShell>
  );
}
