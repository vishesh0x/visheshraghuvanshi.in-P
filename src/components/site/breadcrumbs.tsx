import { jsonLdString } from "@/lib/json-ld";
import { Link } from "@tanstack/react-router";

import { absoluteUrl } from "@/lib/site-url";

export type Crumb = { label: string; to?: string };

/**
 * Visible breadcrumb trail plus a matching schema.org BreadcrumbList. Search
 * engines use BreadcrumbList to render the path in results (instead of the
 * raw URL), and it reinforces internal linking / site hierarchy signals.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.to ? { item: absoluteUrl(item.to) } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <ol className="label-mono flex flex-wrap items-center gap-2 text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "text-foreground" : ""}>
                  {item.label}
                </span>
              )}
              {!isLast ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
