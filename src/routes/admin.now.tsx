import type { DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AssetInput } from "@/components/admin/asset-input";
import { DragHandle, SortableBoard, SortableRow, arrayMove } from "@/components/admin/sortable";

import {
  AdminButton,
  AdminField,
  AdminPage,
  EmptyState,
  adminInputClass,
} from "@/components/admin/ui";
import {
  adminListNowItems,
  deleteNowItem,
  reorderNowItems,
  updateNowCategories,
  upsertNowItem,
} from "@/lib/cms/admin.functions";
import { getSiteConfig } from "@/lib/cms/public.functions";
import { NOW_CATEGORIES, nowItemInputSchema, type NowItem, type NowItemInput } from "@/lib/cms/types";

export const Route = createFileRoute("/admin/now")({
  component: NowAdminPage,
});

const BLANK: NowItemInput = {
  category: NOW_CATEGORIES[0],
  title: "",
  description: "",
  image_url: null,
  link_url: null,
  published: true,
  sort_order: 0,
};


function NowAdminPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-now"],
    queryFn: () => adminListNowItems(),
  });
  const { data: siteConfig } = useQuery({
    queryKey: ["site-config"],
    queryFn: () => getSiteConfig(),
  });

  const categories = siteConfig?.now_categories ?? [...NOW_CATEGORIES];
  const [categoryDraft, setCategoryDraft] = useState("");

  const [order, setOrder] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [form, setForm] = useState<NowItemInput>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setOrder(items.map((item) => item.id)), [items]);

  const saveCategories = useMutation({
    mutationFn: (next: string[]) => updateNowCategories({ data: { categories: next } }),
    onSuccess: async (result) => {
      queryClient.setQueryData(["site-config"], (current: typeof siteConfig) =>
        current ? { ...current, now_categories: result.categories } : current,
      );
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function addCategory() {
    const next = categoryDraft.trim().toUpperCase();
    if (!next) return;
    if (categories.includes(next)) {
      setCategoryDraft("");
      return;
    }
    saveCategories.mutate([...categories, next]);
    setCategoryDraft("");
  }

  function removeCategory(category: string) {
    if (categories.length <= 1) {
      toast.error("Keep at least one category.");
      return;
    }
    saveCategories.mutate(categories.filter((item) => item !== category));
  }


  const ordered = useMemo(
    () =>
      order
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is NowItem => Boolean(item)),
    [order, items],
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-now"] }),
      queryClient.invalidateQueries({ queryKey: ["now"] }),
    ]);
  };

  const save = useMutation({
    mutationFn: (payload: { id: string | null; values: NowItemInput }) =>
      upsertNowItem({ data: payload }),
    onSuccess: async () => {
      toast.success("Entry saved.");
      setEditingId(null);
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNowItem({ data: { id } }),
    onSuccess: async () => {
      toast.success("Entry removed.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderNowItems({ data: { ids } }),
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

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = nowItemInputSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate({ id: editingId === "new" ? null : editingId, values: parsed.data });
  }

  return (
    <AdminPage
      title="Now board"
      description="Short-lived status entries grouped by category. Drag to set the order they appear publicly."
      actions={
        <AdminButton
          variant="primary"
          onClick={() => {
            setForm({ ...BLANK, category: categories[0] ?? BLANK.category, sort_order: items.length });
            setErrors({});
            setEditingId("new");
          }}
        >
          New entry
        </AdminButton>
      }
    >
      <div className="mb-10 max-w-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="label-mono text-muted-foreground">Categories</span>
          <span className="label-mono text-muted-foreground/70">Now board</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              disabled={saveCategories.isPending}
              onClick={() => removeCategory(category)}
              className="label-mono border border-border px-2.5 py-1.5 text-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
              title="Remove category"
            >
              {category} ×
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className={adminInputClass}
            placeholder="Add category and press Enter"
            value={categoryDraft}
            onChange={(event) => setCategoryDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addCategory();
            }}
          />
          <AdminButton type="button" disabled={saveCategories.isPending} onClick={addCategory}>
            Add
          </AdminButton>
        </div>
      </div>

      {editingId !== null ? (
        <form onSubmit={submit} className="mb-10 max-w-2xl space-y-6 border border-border bg-card p-5">
          <div className="grid gap-6 sm:grid-cols-2">
            <AdminField label="Category" error={errors["category"]}>
              <select
                className={adminInputClass}
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {[...new Set([...categories, form.category])].map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Title" error={errors["title"]}>
              <input
                className={adminInputClass}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </AdminField>
          </div>
          <AdminField label="Description" error={errors["description"]}>
            <textarea
              rows={3}
              className={`${adminInputClass} resize-y`}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </AdminField>
          <AdminField label="Image" hint="optional" error={errors["image_url"]}>
            <AssetInput
              value={form.image_url}
              onChange={(value) => setForm({ ...form, image_url: value })}
            />
          </AdminField>
          <AdminField label="Link" hint="optional" error={errors["link_url"]}>
            <input
              className={adminInputClass}
              placeholder="https://"
              value={form.link_url ?? ""}
              onChange={(event) => setForm({ ...form, link_url: event.target.value || null })}
            />
          </AdminField>

          <label className="label-mono flex items-center gap-3 text-foreground">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) => setForm({ ...form, published: event.target.checked })}
              className="h-4 w-4 accent-[var(--signal)]"
            />
            Published
          </label>
          <div className="flex gap-2">
            <AdminButton variant="primary" type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save entry"}
            </AdminButton>
            <AdminButton type="button" onClick={() => setEditingId(null)}>
              Cancel
            </AdminButton>
          </div>
        </form>
      ) : null}

      {isLoading ? (
        <p className="label-mono text-muted-foreground">Loading board…</p>
      ) : ordered.length === 0 ? (
        <EmptyState message="The board is empty." />
      ) : (
        <SortableBoard items={order} onDragEnd={handleDragEnd}>
          <div className="divide-y divide-border border border-border">
            {ordered.map((item) => (
              <SortableRow key={item.id} id={item.id}>
                {(handleProps) => (
                  <div className="flex items-center gap-3 bg-card px-3 py-3.5">
                    <DragHandle {...handleProps} />
                    <span className="label-mono w-24 shrink-0 text-signal-text">{item.category}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-foreground">{item.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <span
                      className={
                        item.published
                          ? "label-mono bg-signal px-2 py-1 text-signal-foreground"
                          : "label-mono border border-border px-2 py-1 text-muted-foreground"
                      }
                    >
                      {item.published ? "Live" : "Hidden"}
                    </span>
                    <AdminButton
                      type="button"
                      onClick={() => {
                        setForm({
                          category: item.category,
                          title: item.title,
                          description: item.description,
                          image_url: item.image_url,
                          link_url: item.link_url,
                          published: item.published,
                          sort_order: item.sort_order,
                        });

                        setErrors({});
                        setEditingId(item.id);
                      }}
                    >
                      Edit
                    </AdminButton>
                    <AdminButton
                      type="button"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Delete “${item.title}”?`)) remove.mutate(item.id);
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
