import type { DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  adminGetLegalPage,
  adminListFaqItems,
  deleteFaqItem,
  reorderFaqItems,
  updateLegalPage,
  upsertFaqItem,
} from "@/lib/cms/admin.functions";
import type { FaqItem, FaqItemInput, LegalPageKey } from "@/lib/cms/types";

export const Route = createFileRoute("/admin/content")({
  component: ContentPage,
});

const TABS = [
  { key: "faq", label: "FAQ" },
  { key: "privacy", label: "Privacy policy" },
  { key: "terms", label: "Terms of use" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function ContentPage() {
  const [tab, setTab] = useState<TabKey>("faq");

  return (
    <AdminPage
      title="Content"
      description="FAQ entries and the Privacy / Terms pages - all editable here instead of requiring a code change."
    >
      <div className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "label-mono bg-signal px-3 py-2 text-signal-foreground"
                : "label-mono border border-border px-3 py-2 text-muted-foreground hover:text-foreground"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "faq" ? <FaqEditor /> : <LegalEditor pageKey={tab} label={TABS.find((t) => t.key === tab)!.label} />}
    </AdminPage>
  );
}

const BLANK_FAQ: FaqItemInput = { question: "", answer: "", published: true, sort_order: 0 };

function FaqEditor() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-faq"],
    queryFn: () => adminListFaqItems(),
  });

  const [order, setOrder] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [form, setForm] = useState<FaqItemInput>(BLANK_FAQ);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setOrder(items.map((item) => item.id)), [items]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-faq"] });

  const save = useMutation({
    mutationFn: (payload: { id: string | null; values: FaqItemInput }) =>
      upsertFaqItem({ data: payload }),
    onSuccess: async () => {
      toast.success("FAQ item saved.");
      setEditingId(null);
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFaqItem({ data: { id } }),
    onSuccess: async () => {
      toast.success("FAQ item deleted.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderFaqItems({ data: { ids } }),
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
    setForm({ ...BLANK_FAQ, sort_order: items.length });
    setErrors({});
    setEditingId("new");
  }

  function startEdit(item: FaqItem) {
    setForm({
      question: item.question,
      answer: item.answer,
      published: item.published,
      sort_order: item.sort_order,
    });
    setErrors({});
    setEditingId(item.id);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      setErrors({ question: !form.question.trim() ? "Required." : "", answer: !form.answer.trim() ? "Required." : "" });
      toast.error("Fix the highlighted fields.");
      return;
    }
    save.mutate({ id: editingId === "new" ? null : editingId, values: form });
  }

  const ordered = order
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is FaqItem => Boolean(item));

  if (editingId !== null) {
    return (
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <AdminField label="Question" error={errors["question"]}>
          <input
            className={adminInputClass}
            value={form.question}
            onChange={(event) => setForm({ ...form, question: event.target.value })}
          />
        </AdminField>
        <AdminField label="Answer" error={errors["answer"]}>
          <textarea
            rows={4}
            className={`${adminInputClass} resize-y`}
            value={form.answer}
            onChange={(event) => setForm({ ...form, answer: event.target.value })}
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
          <AdminButton type="button" onClick={() => setEditingId(null)}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </AdminButton>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <AdminButton variant="primary" onClick={startNew}>
          New question
        </AdminButton>
      </div>
      {isLoading ? (
        <p className="label-mono text-muted-foreground">Loading…</p>
      ) : ordered.length === 0 ? (
        <EmptyState message="No FAQ entries yet." />
      ) : (
        <SortableBoard items={order} onDragEnd={handleDragEnd}>
          <div className="max-w-2xl divide-y divide-border border border-border">
            {ordered.map((item) => (
              <SortableRow key={item.id} id={item.id}>
                {(handleProps) => (
                  <div className="flex items-center gap-3 bg-card px-3 py-3.5">
                    <DragHandle {...handleProps} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-foreground">{item.question}</p>
                      <p className="label-mono mt-1 text-muted-foreground">
                        {item.published ? "Published" : "Hidden"}
                      </p>
                    </div>
                    <AdminButton type="button" onClick={() => startEdit(item)}>
                      Edit
                    </AdminButton>
                    <AdminButton
                      type="button"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Delete "${item.question}"?`)) remove.mutate(item.id);
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
    </div>
  );
}

function LegalEditor({ pageKey, label }: { pageKey: LegalPageKey; label: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-legal", pageKey],
    queryFn: () => adminGetLegalPage({ data: { pageKey } }),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("<p></p>");

  useEffect(() => {
    if (data) {
      setTitle(data.title || label);
      setBody(data.body_html || "<p></p>");
    }
  }, [data, label]);

  const save = useMutation({
    mutationFn: () => updateLegalPage({ data: { page_key: pageKey, title, body_html: body } }),
    onSuccess: async () => {
      toast.success(`${label} saved.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-legal", pageKey] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <p className="label-mono text-muted-foreground">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <AdminField label="Page title">
        <input className={adminInputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </AdminField>
      <AdminField label="Body" hint="WYSIWYG">
        <RichTextEditor value={body} onChange={setBody} />
      </AdminField>
      <AdminButton variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving…" : `Save ${label}`}
      </AdminButton>
    </div>
  );
}
