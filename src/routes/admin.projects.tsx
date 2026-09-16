import type { DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AssetInput } from "@/components/admin/asset-input";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

import { DragHandle, SortableBoard, SortableRow, arrayMove } from "@/components/admin/sortable";
import {
  AdminButton,
  AdminField,
  AdminPage,
  EmptyState,
  adminInputClass,
} from "@/components/admin/ui";
import {
  adminListProjects,
  deleteProject,
  reorderProjects,
  upsertProject,
} from "@/lib/cms/admin.functions";
import { projectInputSchema, type Project, type ProjectInput } from "@/lib/cms/types";

export const Route = createFileRoute("/admin/projects")({
  component: ProjectsAdminPage,
});

const BLANK: ProjectInput = {
  slug: "",
  title: "",
  summary: "",
  body: "<p></p>",
  cover_url: null,
  live_url: null,
  source_url: null,
  tags: [],
  year: new Date().getFullYear(),
  featured: false,
  published: false,
  sort_order: 0,
  meta_title: null,
  meta_description: null,
};

function toInput(project: Project): ProjectInput {
  return {
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    body: project.body,
    cover_url: project.cover_url,
    live_url: project.live_url,
    source_url: project.source_url,
    tags: project.tags,
    year: project.year,
    featured: project.featured,
    published: project.published,
    sort_order: project.sort_order,
    meta_title: project.meta_title,
    meta_description: project.meta_description,
  };
}

function ProjectsAdminPage() {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: () => adminListProjects(),
  });

  const [order, setOrder] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [form, setForm] = useState<ProjectInput>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => setOrder(projects.map((project) => project.id)), [projects]);

  const ordered = useMemo(
    () =>
      order
        .map((id) => projects.find((project) => project.id === id))
        .filter((project): project is Project => Boolean(project)),
    [order, projects],
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);
  };

  const save = useMutation({
    mutationFn: (payload: { id: string | null; values: ProjectInput }) =>
      upsertProject({ data: payload }),
    onSuccess: async () => {
      toast.success("Project saved.");
      setEditingId(null);
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject({ data: { id } }),
    onSuccess: async () => {
      toast.success("Project deleted.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderProjects({ data: { ids } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    reorder.mutate(next);
  }

  function startNew() {
    setForm({ ...BLANK, sort_order: projects.length });
    setErrors({});
    setEditingId("new");
  }

  function startEdit(project: Project) {
    setForm(toInput(project));
    setErrors({});
    setEditingId(project.id);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = projectInputSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Fix the highlighted fields.");
      return;
    }
    save.mutate({ id: editingId === "new" ? null : editingId, values: parsed.data });
  }

  const set = useCallback(<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  if (editingId !== null) {
    return (
      <AdminPage
        title={editingId === "new" ? "New project" : "Edit project"}
        description="Rich body content, stack tags and publication state for a single record."
        actions={
          <>
            <AdminButton type="button" onClick={() => setEditingId(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              type="submit"
              form="project-form"
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : "Save project"}
            </AdminButton>
          </>
        }
      >
        <form id="project-form" onSubmit={submit} className="max-w-3xl space-y-7">
          <div className="grid gap-6 sm:grid-cols-2">
            <AdminField label="Title" error={errors["title"]}>
              <input
                className={adminInputClass}
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value;
                  set("title", title);
                  if (editingId === "new" && !form.slug) {
                    set(
                      "slug",
                      title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
                    );
                  }
                }}
              />
            </AdminField>
            <AdminField label="Slug" error={errors["slug"]}>
              <input
                className={adminInputClass}
                value={form.slug}
                onChange={(event) => set("slug", event.target.value)}
              />
            </AdminField>
          </div>

          <AdminField label="Summary" error={errors["summary"]}>
            <textarea
              rows={3}
              className={`${adminInputClass} resize-y`}
              value={form.summary}
              onChange={(event) => set("summary", event.target.value)}
            />
          </AdminField>

          <AdminField label="Body" hint="WYSIWYG" error={errors["body"]}>
            <RichTextEditor value={form.body} onChange={(html) => set("body", html)} />
          </AdminField>

          <div className="grid gap-6 sm:grid-cols-2">
            <AdminField label="Cover image" error={errors["cover_url"]}>
              <AssetInput
                value={form.cover_url}
                onChange={(value) => set("cover_url", value)}
              />
            </AdminField>

            <AdminField label="Year" error={errors["year"]}>
              <input
                type="number"
                className={adminInputClass}
                value={form.year}
                onChange={(event) => set("year", Number(event.target.value))}
              />
            </AdminField>
            <AdminField label="Live URL" error={errors["live_url"]}>
              <input
                className={adminInputClass}
                value={form.live_url ?? ""}
                onChange={(event) => set("live_url", event.target.value || null)}
              />
            </AdminField>
            <AdminField label="Source URL" error={errors["source_url"]}>
              <input
                className={adminInputClass}
                value={form.source_url ?? ""}
                onChange={(event) => set("source_url", event.target.value || null)}
              />
            </AdminField>
          </div>

          <AdminField label="Stack tags" error={errors["tags"]}>
            <div className="flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => set("tags", form.tags.filter((item) => item !== tag))}
                  className="label-mono border border-border px-2.5 py-1.5 text-foreground hover:border-destructive hover:text-destructive"
                >
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className={adminInputClass}
                placeholder="Add tag and press Enter"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const tag = tagDraft.trim().toUpperCase();
                  if (tag && !form.tags.includes(tag)) set("tags", [...form.tags, tag]);
                  setTagDraft("");
                }}
              />
            </div>
          </AdminField>

          <div className="space-y-6 border-t border-border pt-6">
            <p className="label-mono text-muted-foreground">
              SEO - leave blank to fall back to Title / Summary above
            </p>
            <AdminField label="Meta title" hint="<title>" error={errors["meta_title"]}>
              <input
                className={adminInputClass}
                value={form.meta_title ?? ""}
                onChange={(event) => set("meta_title", event.target.value || null)}
                placeholder={form.title || "Falls back to project title"}
              />
            </AdminField>
            <AdminField label="Meta description" error={errors["meta_description"]}>
              <textarea
                rows={2}
                className={`${adminInputClass} resize-y`}
                value={form.meta_description ?? ""}
                onChange={(event) => set("meta_description", event.target.value || null)}
                placeholder={form.summary || "Falls back to project summary"}
              />
            </AdminField>
          </div>

          <div className="flex flex-wrap gap-6 border-t border-border pt-6">
            <label className="label-mono flex items-center gap-3 text-foreground">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(event) => set("published", event.target.checked)}
                className="h-4 w-4 accent-[var(--signal)]"
              />
              Published
            </label>
            <label className="label-mono flex items-center gap-3 text-foreground">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) => set("featured", event.target.checked)}
                className="h-4 w-4 accent-[var(--signal)]"
              />
              Featured on home
            </label>
          </div>
        </form>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Projects"
      description="Drag to reorder the public index. Each record carries its own rich body, stack tags and links."
      actions={
        <AdminButton variant="primary" onClick={startNew}>
          New project
        </AdminButton>
      }
    >
      {isLoading ? (
        <p className="label-mono text-muted-foreground">Loading records…</p>
      ) : ordered.length === 0 ? (
        <EmptyState message="No projects yet - create the first record." />
      ) : (
        <SortableBoard items={order} onDragEnd={handleDragEnd}>
          <div className="divide-y divide-border border border-border">
            {ordered.map((project, index) => (
              <SortableRow key={project.id} id={project.id}>
                {(handleProps) => (
                  <div className="flex items-center gap-3 bg-card px-3 py-3.5">
                    <DragHandle {...handleProps} />
                    <span className="label-mono w-8 text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-foreground">{project.title}</p>
                      <p className="label-mono mt-1.5 text-muted-foreground">
                        {project.slug} · {project.year} · {project.tags.join(" ")}
                      </p>
                    </div>
                    <span
                      className={
                        project.published
                          ? "label-mono bg-signal px-2 py-1 text-signal-foreground"
                          : "label-mono border border-border px-2 py-1 text-muted-foreground"
                      }
                    >
                      {project.published ? "Live" : "Draft"}
                    </span>
                    {project.featured ? (
                      <span className="label-mono hidden border border-border px-2 py-1 text-muted-foreground sm:inline">
                        Featured
                      </span>
                    ) : null}
                    <AdminButton type="button" onClick={() => startEdit(project)}>
                      Edit
                    </AdminButton>
                    <AdminButton
                      type="button"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Delete “${project.title}”?`)) remove.mutate(project.id);
                      }}
                    >
                      Delete
                    </AdminButton>
                  </div>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableBoard>
      )}
    </AdminPage>
  );
}
