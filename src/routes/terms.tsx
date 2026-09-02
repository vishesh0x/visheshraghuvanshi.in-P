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

export const Route = createFileRoute("/terms")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteConfigQuery()),
      context.queryClient.ensureQueryData(legalQuery("terms")),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Terms of use - Portfolio OS" },
      {
        name: "description",
        content: "Terms for using this site, its content, and the contact form.",
      },
      { property: "og:title", content: "Terms of use" },
      { property: "og:description", content: "Terms for using this site and its content." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { data: config } = useSuspenseQuery(siteConfigQuery());
  const { data: page } = useSuspenseQuery(legalQuery("terms"));
  const updated = new Date().toISOString().slice(0, 10);

  return (
    <SiteShell config={config}>
      <PageHeader
        crumbs={[{ label: "Home", to: "/" }, { label: "Terms" }]}
        eyebrow="Document / 06"
        title={page.title || "Terms of use"}
        description={`Last updated ${updated}. By using this site you agree to the terms below.`}
      />

      <Container className="py-12 sm:py-16">
        <article
          className="prose-technical max-w-2xl text-[0.95rem]"
          dangerouslySetInnerHTML={{ __html: page.body_html }}
        />

        <p className="label-mono mt-10">
          <Link to="/privacy" className="border-b border-signal pb-1 text-foreground">
            Privacy policy →
          </Link>
        </p>
      </Container>
    </SiteShell>
  );
}
