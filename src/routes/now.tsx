import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Container, PageHeader } from "@/components/site/primitives";
import { SiteShell } from "@/components/site/site-shell";
import { nowQuery, pageMetaQuery, siteConfigQuery } from "@/lib/cms/queries";
import { CdnImage } from "@/components/site/cdn-image";

export const Route = createFileRoute("/now")({
  loader: async ({ context }) => {
    const [, , meta] = await Promise.all([
      context.queryClient.ensureQueryData(siteConfigQuery()),
      context.queryClient.ensureQueryData(nowQuery()),
      context.queryClient.ensureQueryData(pageMetaQuery()),
    ]);
    return { meta: meta.now };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.meta.title ?? "Now" },
      { name: "description", content: loaderData?.meta.description ?? "" },
      { property: "og:title", content: loaderData?.meta.title ?? "Now" },
      { property: "og:description", content: loaderData?.meta.description ?? "" },
    ],
  }),
  component: NowPage,
});

function NowPage() {
  const { data: config } = useSuspenseQuery(siteConfigQuery());
  const { data: items } = useSuspenseQuery(nowQuery());

  const categories = [...new Set(items.map((item) => item.category))];

  return (
    <SiteShell config={config}>
      <PageHeader
        crumbs={[{ label: "Home", to: "/" }, { label: "Now" }]}
        eyebrow="Board / 02"
        title="Now"
        description="What has my attention at this exact moment. Written by hand, updated often, never automated."
      />

      <Container className="py-12 sm:py-16">
        {categories.length === 0 ? (
          <p className="label-mono text-muted-foreground">The board is empty right now.</p>
        ) : (
          <div className="space-y-12">
            {categories.map((category) => {
              const group = items.filter((item) => item.category === category);
              return (
                <section key={category}>
                  <div className="flex items-baseline justify-between border-b border-border pb-3">
                    <h2 className="label-mono text-signal-text">{category}</h2>
                    <span className="label-mono text-muted-foreground">
                      {String(group.length).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-px grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
                    {group.map((item) => (
                      <article key={item.id} className="border border-border bg-background">
                        {item.image_url ? (
                          <CdnImage
                            src={item.image_url}
                            alt={item.title}
                            widths={[320, 480, 640, 960]}
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            aspect={5 / 2}
                            quality={75}
                            className="aspect-[5/2] w-full border-b border-border object-cover"
                          />
                        ) : null}
                        <div className="p-5">
                          <h3 className="text-base font-medium text-foreground">{item.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                          {item.link_url ? (
                            <a
                              href={item.link_url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="label-mono mt-4 inline-block text-signal-text hover:underline"
                            >
                              Open link ↗
                            </a>
                          ) : null}
                          <p className="label-mono mt-4 text-muted-foreground">
                            Updated {new Date(item.updated_at).toISOString().slice(0, 10)}
                          </p>
                        </div>
                      </article>
                    ))}

                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Container>
    </SiteShell>
  );
}
