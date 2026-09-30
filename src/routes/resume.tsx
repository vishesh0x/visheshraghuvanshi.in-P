import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Container, PageHeader } from "@/components/site/primitives";
import { ObfuscatedMailLink } from "@/components/site/obfuscated-mail-link";
import { SiteShell } from "@/components/site/site-shell";
import { pageMetaQuery, resumeQuery, siteConfigQuery } from "@/lib/cms/queries";

export const Route = createFileRoute("/resume")({
  loader: async ({ context }) => {
    const [, , meta] = await Promise.all([
      context.queryClient.ensureQueryData(siteConfigQuery()),
      context.queryClient.ensureQueryData(resumeQuery()),
      context.queryClient.ensureQueryData(pageMetaQuery()),
    ]);
    return { meta: meta.resume };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.meta.title ?? "Resume" },
      { name: "description", content: loaderData?.meta.description ?? "" },
      { property: "og:title", content: loaderData?.meta.title ?? "Resume" },
      { property: "og:description", content: loaderData?.meta.description ?? "" },
    ],
  }),
  component: ResumePage,
});

function ResumePage() {
  const { data: config } = useSuspenseQuery(siteConfigQuery());
  const { data: sections } = useSuspenseQuery(resumeQuery());

  return (
    <SiteShell config={config}>
      <PageHeader
        crumbs={[{ label: "Home", to: "/" }, { label: "Resume" }]}
        eyebrow="Document / 03"
        title="Resume"
        description="Composed section by section in the control dashboard, rendered here without a PDF round trip."
      />

      <Container className="py-12 sm:py-16">
        <div className="inline-flex flex-wrap items-stretch gap-px bg-border">
          <div className="bg-background px-4 py-3">
            <p className="label-mono text-muted-foreground">Owner</p>
            <p className="mt-1 font-mono text-sm text-foreground">{config.owner_name}</p>
          </div>
          <div className="bg-background px-4 py-3">
            <ObfuscatedMailLink
              email={config.contact_email}
              label="Contact"
              addressClassName="mt-1 font-mono text-sm text-foreground"
            />
          </div>
          {config.resume_pdf_url ? (
            <a
              href={config.resume_pdf_url}
              download
              className="label-mono bg-foreground px-5 py-5 text-background hover:opacity-85 print:hidden"
            >
              Download PDF ↓
            </a>
          ) : (
            <button
              type="button"
              onClick={() => window.print()}
              className="label-mono bg-foreground px-5 py-5 text-background hover:opacity-85 print:hidden"
            >
              Download PDF ↓
            </button>
          )}

        </div>

        <div className="mt-12 space-y-14">
          {sections.map((section, sectionIndex) => (
            <section key={section.id}>
              <div className="flex items-baseline gap-4 border-b border-border pb-3">
                <span className="label-mono text-signal-text">
                  {String(sectionIndex + 1).padStart(2, "0")}
                </span>
                <h2 className="font-mono text-lg tracking-tight text-foreground">
                  {section.title}
                </h2>
              </div>

              <div className="divide-y divide-border">
                {section.entries.map((entry) => {
                  const hasDates = Boolean(entry.start_date || entry.end_date);
                  const hasMeta = hasDates || Boolean(entry.location);
                  return (
                    <article
                      key={entry.id}
                      className={
                        hasMeta
                          ? "grid gap-4 py-6 sm:grid-cols-[180px_1fr] sm:gap-8"
                          : "py-6"
                      }
                    >
                      {hasMeta ? (
                        <div>
                          {hasDates ? (
                            <p className="label-mono text-foreground">
                              {entry.start_date}
                              {entry.end_date ? ` - ${entry.end_date}` : ""}
                            </p>
                          ) : null}
                          {entry.location ? (
                            <p className="label-mono mt-2 text-muted-foreground">{entry.location}</p>
                          ) : null}
                        </div>
                      ) : null}
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{entry.role}</h3>
                        {entry.organization ? (
                          <p className="label-mono mt-1.5 text-signal-text">{entry.organization}</p>
                        ) : null}
                        {entry.description ? (
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {entry.description}
                          </p>
                        ) : null}
                        {entry.bullets.length > 0 ? (
                          <ul className="mt-4 space-y-2">
                            {entry.bullets.map((bullet, index) => (
                              <li
                                key={index}
                                className="relative pl-5 text-sm leading-relaxed text-muted-foreground"
                              >
                                <span className="absolute left-0 text-signal-text">-</span>
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
                {section.entries.length === 0 ? (
                  <p className="label-mono py-6 text-muted-foreground">No entries yet.</p>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </SiteShell>
  );
}
