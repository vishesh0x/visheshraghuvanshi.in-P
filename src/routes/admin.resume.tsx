import type { DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DragHandle, SortableBoard, SortableRow, arrayMove } from "@/components/admin/sortable";
import {
  AdminButton,
  AdminField,
  AdminPage,
  EmptyState,
  adminInputClass,
} from "@/components/admin/ui";
import {
  adminGetResume,
  deleteResumeEntry,
  deleteResumeSection,
  saveResumeLayout,
  upsertResumeEntry,
  upsertResumeSection,
} from "@/lib/cms/admin.functions";
import {
  resumeEntryInputSchema,
  type ResumeEntry,
  type ResumeEntryInput,
  type ResumeSectionWithEntries,
} from "@/lib/cms/types";

export const Route = createFileRoute("/admin/resume")({
  component: ResumeBuilderPage,
});

function blankEntry(sectionId: string): ResumeEntryInput {
  return {
    section_id: sectionId,
    role: "",
    organization: "",
    location: "",
    start_date: "",
    end_date: "",
    description: "",
    bullets: [],
    hidden: false,
  };
}

function ResumeBuilderPage() {
  const queryClient = useQueryClient();
  const { data: remote = [], isLoading } = useQuery({
    queryKey: ["admin-resume"],
    queryFn: () => adminGetResume(),
  });

  const [board, setBoard] = useState<ResumeSectionWithEntries[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; values: ResumeEntryInput } | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setBoard(remote);
    setDirty(false);
  }, [remote]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-resume"] }),
      queryClient.invalidateQueries({ queryKey: ["resume"] }),
    ]);
  };

  const persistLayout = useMutation({
    mutationFn: (sections: { id: string; entryIds: string[] }[]) =>
      saveResumeLayout({ data: { sections } }),
    onSuccess: async () => {
      toast.success("Layout saved.");
      setDirty(false);
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveSection = useMutation({
    mutationFn: (payload: { id: string | null; title: string; hidden: boolean }) =>
      upsertResumeSection({ data: payload }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const removeSection = useMutation({
    mutationFn: (id: string) => deleteResumeSection({ data: { id } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const saveEntry = useMutation({
    mutationFn: (payload: { id: string | null; values: ResumeEntryInput }) =>
      upsertResumeEntry({ data: payload }),
    onSuccess: async () => {
      toast.success("Entry saved.");
      setEditing(null);
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => deleteResumeEntry({ data: { id } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  function moveSections(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = board.map((section) => section.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setBoard(next.map((id) => board.find((section) => section.id === id)!));
    setDirty(true);
  }

  function moveEntries(sectionId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBoard((current) =>
      current.map((section) => {
        if (section.id !== sectionId) return section;
        const ids = section.entries.map((entry) => entry.id);
        const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
        return {
          ...section,
          entries: next.map((id) => section.entries.find((entry) => entry.id === id)!),
        };
      }),
    );
    setDirty(true);
  }

  function moveEntryToSection(entry: ResumeEntry, direction: -1 | 1) {
    const index = board.findIndex((section) => section.id === entry.section_id);
    const target = board[index + direction];
    if (!target) return;
    setBoard((current) =>
      current.map((section) => {
        if (section.id === entry.section_id) {
          return { ...section, entries: section.entries.filter((item) => item.id !== entry.id) };
        }
        if (section.id === target.id) {
          return {
            ...section,
            entries: [...section.entries, { ...entry, section_id: target.id }],
          };
        }
        return section;
      }),
    );
    setDirty(true);
  }

  function submitEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const parsed = resumeEntryInputSchema.safeParse(editing.values);
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
    saveEntry.mutate({ id: editing.id, values: parsed.data });
  }

  return (
    <AdminPage
      title="Resume builder"
      description="Drag sections and entries into place, move an entry between sections, then commit the layout."
      actions={
        <>
          <AdminButton
            onClick={() => {
              const title = window.prompt("Section title");
              if (title?.trim()) saveSection.mutate({ id: null, title: title.trim(), hidden: false });
            }}
          >
            Add section
          </AdminButton>
          <AdminButton
            variant="primary"
            disabled={!dirty || persistLayout.isPending}
            onClick={() =>
              persistLayout.mutate(
                board.map((section) => ({
                  id: section.id,
                  entryIds: section.entries.map((entry) => entry.id),
                })),
              )
            }
          >
            {persistLayout.isPending ? "Saving…" : dirty ? "Save layout" : "Layout saved"}
          </AdminButton>
        </>
      }
    >
      {editing ? (
        <form
          onSubmit={submitEntry}
          className="mb-10 max-w-2xl space-y-6 border border-border bg-card p-5"
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <AdminField label="Role" error={errors["role"]}>
              <input
                className={adminInputClass}
                value={editing.values.role}
                onChange={(event) =>
                  setEditing({ ...editing, values: { ...editing.values, role: event.target.value } })
                }
              />
            </AdminField>
            <AdminField label="Organization" error={errors["organization"]}>
              <input
                className={adminInputClass}
                value={editing.values.organization}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    values: { ...editing.values, organization: event.target.value },
                  })
                }
              />
            </AdminField>
            <AdminField label="Start" hint="optional" error={errors["start_date"]}>
              <input
                className={adminInputClass}
                placeholder="e.g. 2023 - leave blank for entries with no date (Skills, etc.)"
                value={editing.values.start_date}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    values: { ...editing.values, start_date: event.target.value },
                  })
                }
              />
            </AdminField>
            <AdminField label="End" hint="optional" error={errors["end_date"]}>
              <input
                className={adminInputClass}
                placeholder="e.g. Present - leave blank if not applicable"
                value={editing.values.end_date}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    values: { ...editing.values, end_date: event.target.value },
                  })
                }
              />
            </AdminField>
            <AdminField label="Location" error={errors["location"]}>
              <input
                className={adminInputClass}
                value={editing.values.location}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    values: { ...editing.values, location: event.target.value },
                  })
                }
              />
            </AdminField>
          </div>

          <AdminField label="Description" error={errors["description"]}>
            <textarea
              rows={3}
              className={`${adminInputClass} resize-y`}
              value={editing.values.description}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  values: { ...editing.values, description: event.target.value },
                })
              }
            />
          </AdminField>

          <AdminField label="Bullets" hint="one per line" error={errors["bullets"]}>
            <textarea
              rows={4}
              className={`${adminInputClass} resize-y`}
              value={editing.values.bullets.join("\n")}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  values: {
                    ...editing.values,
                    bullets: event.target.value.split("\n").filter((line) => line.trim() !== ""),
                  },
                })
              }
            />
          </AdminField>

          <label className="label-mono flex items-center gap-3 text-foreground">
            <input
              type="checkbox"
              checked={editing.values.hidden}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  values: { ...editing.values, hidden: event.target.checked },
                })
              }
              className="h-4 w-4 accent-[var(--signal)]"
            />
            Hidden from public resume
          </label>

          <div className="flex gap-2">
            <AdminButton variant="primary" type="submit" disabled={saveEntry.isPending}>
              {saveEntry.isPending ? "Saving…" : "Save entry"}
            </AdminButton>
            <AdminButton type="button" onClick={() => setEditing(null)}>
              Cancel
            </AdminButton>
          </div>
        </form>
      ) : null}

      {isLoading ? (
        <p className="label-mono text-muted-foreground">Loading document…</p>
      ) : board.length === 0 ? (
        <EmptyState message="No sections yet - add the first one." />
      ) : (
        <SortableBoard items={board.map((section) => section.id)} onDragEnd={moveSections}>
          <div className="space-y-6">
            {board.map((section) => (
              <SortableRow key={section.id} id={section.id}>
                {(handleProps) => (
                  <section className="border border-border bg-card">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3">
                      <DragHandle {...handleProps} />
                      <h2 className="flex-1 font-mono text-sm text-foreground">{section.title}</h2>
                      {section.hidden ? (
                        <span className="label-mono border border-border px-2 py-1 text-muted-foreground">
                          Hidden
                        </span>
                      ) : null}
                      <AdminButton
                        onClick={() =>
                          saveSection.mutate({
                            id: section.id,
                            title: section.title,
                            hidden: !section.hidden,
                          })
                        }
                      >
                        {section.hidden ? "Show" : "Hide"}
                      </AdminButton>
                      <AdminButton
                        onClick={() => {
                          const title = window.prompt("Section title", section.title);
                          if (title?.trim())
                            saveSection.mutate({
                              id: section.id,
                              title: title.trim(),
                              hidden: section.hidden,
                            });
                        }}
                      >
                        Rename
                      </AdminButton>
                      <AdminButton
                        onClick={() => {
                          setErrors({});
                          setEditing({ id: null, values: blankEntry(section.id) });
                        }}
                      >
                        Add entry
                      </AdminButton>
                      <AdminButton
                        variant="danger"
                        onClick={() => {
                          if (window.confirm(`Delete section “${section.title}” and its entries?`))
                            removeSection.mutate(section.id);
                        }}
                      >
                        Delete
                      </AdminButton>
                    </div>

                    <SortableBoard
                      items={section.entries.map((entry) => entry.id)}
                      onDragEnd={(event) => moveEntries(section.id, event)}
                    >
                      <div className="divide-y divide-border">
                        {section.entries.map((entry) => (
                          <SortableRow key={entry.id} id={entry.id}>
                            {(entryHandle) => (
                              <div className="flex flex-wrap items-center gap-2 px-3 py-3">
                                <DragHandle {...entryHandle} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-mono text-sm text-foreground">
                                    {entry.role}
                                    {entry.organization ? ` · ${entry.organization}` : ""}
                                  </p>
                                  {entry.start_date || entry.end_date ? (
                                    <p className="label-mono mt-1.5 text-muted-foreground">
                                      {entry.start_date}
                                      {entry.end_date ? ` - ${entry.end_date}` : ""}
                                    </p>
                                  ) : null}
                                </div>
                                <AdminButton
                                  title="Move to previous section"
                                  onClick={() => moveEntryToSection(entry, -1)}
                                >
                                  ↑§
                                </AdminButton>
                                <AdminButton
                                  title="Move to next section"
                                  onClick={() => moveEntryToSection(entry, 1)}
                                >
                                  ↓§
                                </AdminButton>
                                <AdminButton
                                  onClick={() => {
                                    setErrors({});
                                    setEditing({
                                      id: entry.id,
                                      values: {
                                        section_id: entry.section_id,
                                        role: entry.role,
                                        organization: entry.organization,
                                        location: entry.location,
                                        start_date: entry.start_date,
                                        end_date: entry.end_date,
                                        description: entry.description,
                                        bullets: entry.bullets,
                                        hidden: entry.hidden,
                                      },
                                    });
                                  }}
                                >
                                  Edit
                                </AdminButton>
                                <AdminButton
                                  variant="danger"
                                  onClick={() => {
                                    if (window.confirm(`Delete “${entry.role}”?`))
                                      removeEntry.mutate(entry.id);
                                  }}
                                >
                                  Delete
                                </AdminButton>
                              </div>
                            )}
                          </SortableRow>
                        ))}
                        {section.entries.length === 0 ? (
                          <p className="label-mono px-3 py-6 text-muted-foreground">
                            No entries in this section.
                          </p>
                        ) : null}
                      </div>
                    </SortableBoard>
                  </section>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableBoard>
      )}
    </AdminPage>
  );
}
