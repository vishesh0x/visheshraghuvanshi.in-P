import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-mono text-2xl tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="pt-8">{children}</div>
    </div>
  );
}

export function AdminField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  // Auto-associate the visible label with its control (and the error message,
  // via aria-describedby) instead of relying on a plain <span> next to an
  // unlabelled input - screen readers otherwise have no way to connect them.
  const generatedId = useId();
  const isElementChild = isValidElement(children);
  const existingId = isElementChild
    ? (children as ReactElement<{ id?: string }>).props.id
    : undefined;
  const fieldId = existingId || generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;

  const control = isElementChild
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: fieldId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": errorId,
      })
    : children;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="label-mono text-muted-foreground">
          {label}
        </label>
        {hint ? <span className="label-mono text-muted-foreground/70">{hint}</span> : null}
      </div>
      <div className="mt-2">{control}</div>
      {error ? (
        <p id={errorId} className="label-mono mt-2 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const adminInputClass =
  "w-full border border-border bg-card px-3 py-2.5 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-signal";

export function AdminButton({
  children,
  variant = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger";
}) {
  return (
    <button
      {...props}
      className={cn(
        "label-mono px-4 py-2.5 transition-colors disabled:opacity-50",
        variant === "primary" && "bg-signal text-signal-foreground hover:opacity-90",
        variant === "default" && "border border-border text-foreground hover:bg-accent",
        variant === "danger" && "border border-destructive text-destructive hover:bg-destructive/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string | number;
  meta?: string;
}) {
  return (
    <div className="bg-background p-5">
      <p className="label-mono text-muted-foreground">{label}</p>
      <p className="mt-3 font-mono text-3xl tracking-tight text-foreground">{value}</p>
      {meta ? <p className="label-mono mt-2 text-signal">{meta}</p> : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-border px-6 py-12 text-center">
      <p className="label-mono text-muted-foreground">{message}</p>
    </div>
  );
}
