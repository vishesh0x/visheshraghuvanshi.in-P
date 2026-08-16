import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminButton, AdminField, AdminPage, adminInputClass } from "@/components/admin/ui";

import { getAdminPageMeta, updatePageMeta } from "@/lib/cms/admin.functions";
import { PAGE_META_KEYS, type PageMeta, type PageMetaKey } from "@/lib/cms/types";

export const Route = createFileRoute("/admin/seo")({
  component: SeoPage,
});

const PAGE_LABELS: Record<PageMetaKey, string> = {
  home: "Home",
  projects: "Projects (index)",
  resume: "Resume",
  now: "Now board",
  contact: "Contact",
};

const PAGE_PATHS: Record<PageMetaKey, string> = {
  home: "/",
  projects: "/projects",
  resume: "/resume",
  now: "/now",
  contact: "/contact",
};

type FormState = Record<PageMetaKey, { title: string; description: string }>;

const EMPTY_ROW = { title: "", description: "" };

function toFormState(rows: PageMeta[]): FormState {
  const state = Object.fromEntries(
    PAGE_META_KEYS.map((key) => [key, { ...EMPTY_ROW }]),
  ) as FormState;
  for (const row of rows) {
    if ((PAGE_META_KEYS as readonly string[]).includes(row.page_key)) {
      state[row.page_key as PageMetaKey] = { title: row.title, description: row.description };
    }
  }
  return state;
}

function SeoPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-page-meta"],
    queryFn: () => getAdminPageMeta(),
  });

  const [form, setForm] = useState<FormState>(() => toFormState([]));
  const [errors, setErrors] = useState<Partial<Record<PageMetaKey, string>>>({});

  useEffect(() => {
    if (data) setForm(toFormState(data));
  }, [data]);

  const mutation = useMutation({
    mutationFn: (input: { page_key: PageMetaKey; title: string; description: string }) =>
      updatePageMeta({ data: input }),
    onSuccess: async (_result, variables) => {
      toast.success(`${PAGE_LABELS[variables.page_key]} metadata saved.`);
      setErrors((prev) => ({ ...prev, [variables.page_key]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["admin-page-meta"] });
    },
    onError: (error: Error, variables) => {
      setErrors((prev) => ({ ...prev, [variables.page_key]: error.message }));
      toast.error(error.message);
    },
  });

  function save(pageKey: PageMetaKey) {
    const row = form[pageKey];
    if (!row.title.trim() || !row.description.trim()) {
      setErrors((prev) => ({ ...prev, [pageKey]: "Title and description are both required." }));
      return;
    }
    mutation.mutate({ page_key: pageKey, title: row.title.trim(), description: row.description.trim() });
  }

  return (
    <AdminPage
      title="SEO"
      description="Browser tab title and meta description for every static page. Individual project pages are edited from the Projects tab instead."
    >
      {isLoading ? (
        <p className="label-mono text-muted-foreground">Loading…</p>
      ) : (
        <div className="max-w-2xl space-y-8">
          {PAGE_META_KEYS.map((key) => (
            <div key={key} className="border border-border bg-card p-5">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <span className="label-mono text-foreground">{PAGE_LABELS[key]}</span>
                <span className="label-mono text-muted-foreground/70">{PAGE_PATHS[key]}</span>
              </div>
              <div className="space-y-4">
                <AdminField label="Title" hint="<title>" error={errors[key]}>
                  <input
                    className={adminInputClass}
                    value={form[key]?.title ?? ""}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], title: event.target.value },
                      }))
                    }
                  />
                </AdminField>
                <AdminField label="Meta description">
                  <textarea
                    rows={2}
                    className={`${adminInputClass} resize-y`}
                    value={form[key]?.description ?? ""}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], description: event.target.value },
                      }))
                    }
                  />
                </AdminField>
                <AdminButton
                  type="button"
                  variant="primary"
                  onClick={() => save(key)}
                  disabled={mutation.isPending}
                >
                  Save
                </AdminButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
