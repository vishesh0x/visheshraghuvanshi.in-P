import type { ReactNode } from "react";

import { Breadcrumbs, type Crumb } from "@/components/site/breadcrumbs";
import { cn } from "@/lib/utils";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-[1400px] px-4 sm:px-6", className)}>{children}</div>;
}

export function SectionHeader({
  index,
  title,
  meta,
}: {
  index: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
      <div className="flex items-baseline gap-4">
        <span className="label-mono text-signal-text">{index}</span>
        <h2 className="font-mono text-lg tracking-tight text-foreground sm:text-xl">{title}</h2>
      </div>
      {meta ? <span className="label-mono text-muted-foreground">{meta}</span> : null}
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="label-mono border border-border px-2 py-1 text-muted-foreground">
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  crumbs,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  crumbs?: Crumb[];
}) {
  return (
    <div className="border-b border-border">
      <Container className="py-14 sm:py-20">
        {crumbs ? <Breadcrumbs items={crumbs} /> : null}
        <p className="label-mono text-signal-text">{eyebrow}</p>
        <h1 className="mt-5 max-w-3xl font-mono text-3xl leading-tight tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </Container>
    </div>
  );
}
