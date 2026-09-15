import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { Container, Tag } from "@/components/site/primitives";
import { SiteShell } from "@/components/site/site-shell";
import { projectQuery, siteConfigQuery } from "@/lib/cms/queries";
import { cdnImage, cdnImageSrcSet } from "@/lib/site-image";
import { absoluteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ context, params }) => {
    const [, project] = await Promise.all([
      context.queryClient.ensureQueryData(siteConfigQuery()),
      context.queryClient.ensureQueryData(projectQuery(params.slug)),
    ]);
    if (!project) throw notFound();
    return {
      title: project.meta_title || project.title,
      summary: project.meta_description || project.summary,
      cover_url: project.cover_url,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Project unavailable - Portfolio OS" }, { name: "robots", content: "noindex" }],
      };
    }
    return {
      meta: [
        { title: `${loaderData.title} - Portfolio OS` },
        { name: "description", content: loaderData.summary },
        { property: "og:title", content: `${loaderData.title} - Portfolio OS` },
        { property: "og:description", content: loaderData.summary },
        { property: "og:type", content: "article" },
        ...(loaderData.cover_url
          ? [
              { property: "og:image", content: absoluteUrl(loaderData.cover_url) },
              { name: "twitter:image", content: absoluteUrl(loaderData.cover_url) },
            ]
          : []),
      ],
    };
  },
  component: ProjectDetail,
  notFoundComponent: ProjectMissing,
});

function ProjectMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <p className="label-mono text-signal">404 / record not found</p>
        <h1 className="mt-4 font-mono text-2xl text-foreground">This project isn't published</h1>
        <Link to="/projects" className="label-mono mt-6 inline-block border-b border-signal pb-1">
          Back to index
        </Link>
      </div>
    </div>
  );
}

function ProjectDetail() {
  const { slug } = Route.useParams();
  const { data: config } = useSuspenseQuery(siteConfigQuery());
  const { data: project } = useSuspenseQuery(projectQuery(slug));

  if (!project) return <ProjectMissing />;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary,
    ...(project.cover_url ? { image: absoluteUrl(project.cover_url) } : {}),
    ...(project.source_url ? { codeRepository: project.source_url } : {}),
    dateModified: project.updated_at,
    author: { "@type": "Person", name: config.owner_name },
    creator: { "@type": "Person", name: config.owner_name },
    keywords: project.tags.join(", "),
    url: absoluteUrl(`/projects/${project.slug}`),
  };

  return (
    <SiteShell config={config}>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="border-b border-border">
        <Container className="py-12 sm:py-16">
          <Breadcrumbs
            items={[
              { label: "Home", to: "/" },
              { label: "Projects", to: "/projects" },
              { label: project.title },
            ]}
          />
          <div className="mt-8 flex flex-wrap items-baseline gap-4">
            <span className="label-mono text-signal">{project.year}</span>
            <h1 className="font-mono text-3xl leading-tight tracking-tight text-foreground sm:text-5xl">
              {project.title}
            </h1>
          </div>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {project.summary}
          </p>
          <div className="mt-7 flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </Container>
      </div>

      {project.cover_url ? (
        <div className="border-b border-border">
          <Container className="py-0">
            <img
              src={cdnImage(project.cover_url!, { width: 1400, height: 788, quality: 80 })}
              srcSet={cdnImageSrcSet(project.cover_url!, { width: 700, height: 394, quality: 80 })}
              sizes="100vw"
              alt={`${project.title} cover`}
              width={1400}
              height={788}
              className="aspect-[16/9] w-full border-x border-border object-cover"
            />
          </Container>
        </div>
      ) : null}

      <Container className="grid gap-12 py-14 lg:grid-cols-[1fr_280px] sm:py-20">
        <article
          className="prose-technical max-w-2xl text-[0.95rem]"
          dangerouslySetInnerHTML={{ __html: project.body }}
        />

        <aside className="self-start border border-border">
          <div className="border-b border-border px-4 py-3">
            <p className="label-mono text-muted-foreground">Record</p>
          </div>
          <dl className="divide-y divide-border">
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="label-mono text-muted-foreground">Year</dt>
              <dd className="font-mono text-xs text-foreground">{project.year}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="label-mono text-muted-foreground">Slug</dt>
              <dd className="font-mono text-xs text-foreground">{project.slug}</dd>
            </div>
            {project.live_url ? (
              <a
                href={project.live_url}
                target="_blank"
                rel="noreferrer noopener"
                className="label-mono block px-4 py-3 text-foreground hover:text-signal"
              >
                Live build ↗
              </a>
            ) : null}
            {project.source_url ? (
              <a
                href={project.source_url}
                target="_blank"
                rel="noreferrer noopener"
                className="label-mono block px-4 py-3 text-foreground hover:text-signal"
              >
                Source ↗
              </a>
            ) : null}
          </dl>
        </aside>
      </Container>
    </SiteShell>
  );
}
