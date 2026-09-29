import { jsonLdString } from "@/lib/json-ld";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container, PageHeader } from "@/components/site/primitives";
import { SiteShell } from "@/components/site/site-shell";
import { getFaqItems } from "@/lib/cms/public.functions";
import { siteConfigQuery } from "@/lib/cms/queries";

const faqQuery = () => queryOptions({ queryKey: ["faq-items"], queryFn: () => getFaqItems() });

export const Route = createFileRoute("/faq")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteConfigQuery()),
      context.queryClient.ensureQueryData(faqQuery()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "FAQ - Portfolio OS" },
      {
        name: "description",
        content: "Answers to common questions about working together, the stack, and this site.",
      },
      { property: "og:title", content: "FAQ" },
      {
        property: "og:description",
        content: "Answers to common questions about working together and this site.",
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  const { data: config } = useSuspenseQuery(siteConfigQuery());
  const { data: faqs } = useSuspenseQuery(faqQuery());

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <SiteShell config={config}>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />

      <PageHeader
        crumbs={[{ label: "Home", to: "/" }, { label: "FAQ" }]}
        eyebrow="Document / 07"
        title="Frequently asked questions"
        description="The questions that come up most often about working together and how this site is built."
      />

      <Container className="py-12 sm:py-16">
        {faqs.length === 0 ? (
          <p className="label-mono text-muted-foreground">No questions published yet.</p>
        ) : (
          <Accordion type="single" collapsible className="max-w-2xl">
            {faqs.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id}>
                <AccordionTrigger className="font-mono text-base text-foreground">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <p className="label-mono mt-10 text-muted-foreground">
          Didn't find what you needed?{" "}
          <Link to="/contact" className="border-b border-signal pb-1 text-foreground">
            Ask directly →
          </Link>
        </p>
      </Container>
    </SiteShell>
  );
}
