import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Container, PageHeader } from "@/components/site/primitives";
import { SiteShell } from "@/components/site/site-shell";
import { getLegalPage } from "@/lib/cms/public.functions";
import { siteConfigQuery } from "@/lib/cms/queries";

const legalQuery = (pageKey: "privacy" | "terms") =>
  queryOptions({
    queryKey: ["legal-page", pageKey],
    queryFn: () => getLegalPage({ data: { pageKey } }),
  });

export const Route = createFileRoute("/privacy")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteConfigQuery()),
      context.queryClient.ensureQueryData(legalQuery("privacy")),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Privacy policy - Portfolio OS" },
      {
        name: "description",
        content: "What this site collects, why, and how to get in touch about your data.",
      },
      { property: "og:title", content: "Privacy policy" },
      { property: "og:description", content: "What this site collects and why." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { data: config } = useSuspenseQuery(siteConfigQuery());
  const { data: page } = useSuspenseQuery(legalQuery("privacy"));
  const updated = new Date().toISOString().slice(0, 10);

  return (
    <SiteShell config={config}>
      <PageHeader
        crumbs={[{ label: "Home", to: "/" }, { label: "Privacy" }]}
        eyebrow="Document / 05"
        title={page.title || "Privacy policy"}
        description={`Last updated ${updated}. Plain language, no legalese padding.`}
      />

      <Container className="py-12 sm:py-16">
        <article
          className="prose-technical max-w-2xl text-[0.95rem]"
          dangerouslySetInnerHTML={{ __html: page.body_html }}
        />

        <p className="label-mono mt-10">
          <Link to="/terms" className="border-b border-signal pb-1 text-foreground">
            Terms of use →
          </Link>
        </p>
      </Container>
    </SiteShell>
  );
}
