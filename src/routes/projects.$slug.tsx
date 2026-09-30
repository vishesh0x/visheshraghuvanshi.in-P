import { jsonLdString } from "@/lib/json-ld";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { Container, Tag } from "@/components/site/primitives";
import { SiteShell } from "@/components/site/site-shell";
import { projectQuery, siteConfigQuery } from "@/lib/cms/queries";
import { CdnImage } from "@/components/site/cdn-image";
import { cdnImage } from "@/lib/site-image";
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
              { property: "og:image", content: absoluteUrl(cdnImage(loaderData.cover_url, { width: 1200, height: 630, fit: "cover", gravity: "auto", quality: 80 })) },
              { name: "twitter:image", content: absoluteUrl(cdnImage(loaderData.cover_url, { width: 1200, height: 630, fit: "cover", gravity: "auto", quality: 80 })) },
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
        <p className="label-mono text-signal-text">404 / record not found</p>
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
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
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
            <span className="label-mono text-signal-text">{project.year}</span>
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
        <div className="border-b border-border bg-muted/40">
          <Container className="py-0">
            {/*
              Show the WHOLE cover, never crop it: no forced aspect ratio and no
              server-side crop (no `aspect` prop => Cloudflare only scales).
              Artwork that is narrower than the column is centred on a quiet
              panel instead of being stretched or cut.
            */}
            <div className="flex justify-center border-x border-border bg-background">
              <CdnImage
                src={project.cover_url}
                alt={`${project.title} cover`}
                widths={[640, 960, 1280, 1600, 2000]}
                sizes="(min-width: 1400px) 1400px, 100vw"
                quality={80}
                priority
                className="block h-auto max-h-[80vh] w-auto max-w-full object-contain"
              />
            </div>
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
                className="label-mono block px-4 py-3 text-foreground hover:text-signal-text"
              >
                Live build ↗
              </a>
            ) : null}
            {project.source_url ? (
              <a
                href={project.source_url}
                target="_blank"
                rel="noreferrer noopener"
                className="label-mono block px-4 py-3 text-foreground hover:text-signal-text"
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
