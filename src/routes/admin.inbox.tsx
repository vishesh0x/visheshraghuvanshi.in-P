import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AdminButton, AdminPage, EmptyState } from "@/components/admin/ui";
import { deleteMessage, listMessages, updateMessageFlags } from "@/lib/cms/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/inbox")({
  component: InboxPage,
});

type Filter = "all" | "unread" | "starred";

function InboxPage() {
  const queryClient = useQueryClient();
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: () => listMessages(),
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] });

  const flag = useMutation({
    mutationFn: (payload: { id: string; is_read?: boolean; is_starred?: boolean }) =>
      updateMessageFlags({ data: payload }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMessage({ data: { id } }),
    onSuccess: async () => {
      toast.success("Message deleted.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const visible = messages.filter((message) =>
    filter === "unread" ? !message.is_read : filter === "starred" ? message.is_starred : true,
  );

  return (
    <AdminPage
      title="Inbox"
      description="Every message submitted through the contact channel, stored in your own database."
      actions={
        <div className="flex gap-px bg-border">
          {(["all", "unread", "starred"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "label-mono px-4 py-2.5 transition-colors",
                filter === value
                  ? "bg-signal text-signal-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      }
    >
      {isLoading ? (
        <p className="label-mono text-muted-foreground">Loading inbox…</p>
      ) : visible.length === 0 ? (
        <EmptyState message="No messages match this filter." />
      ) : (
        <div className="divide-y divide-border border border-border">
          {visible.map((message) => {
            const open = openId === message.id;
            return (
              <article key={message.id} className={cn("bg-card", !message.is_read && "bg-accent")}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(open ? null : message.id);
                    if (!message.is_read) flag.mutate({ id: message.id, is_read: true });
                  }}
                  className="flex w-full flex-wrap items-baseline gap-3 px-4 py-4 text-left"
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", !message.is_read && "bg-signal")} />
                  <span className="font-mono text-sm text-foreground">{message.subject}</span>
                  <span className="label-mono text-muted-foreground">{message.name}</span>
                  <span className="label-mono ml-auto text-muted-foreground">
                    {new Date(message.created_at).toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                </button>

                {open ? (
                  <div className="border-t border-border px-4 py-4">
                    <p className="label-mono text-signal-text">{message.email}</p>
                    {message.country ? (
                      <p className="label-mono mt-1 text-muted-foreground">
                        Origin {message.country}
                      </p>
                    ) : null}
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {message.message}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <AdminButton
                        onClick={() =>
                          flag.mutate({ id: message.id, is_starred: !message.is_starred })
                        }
                      >
                        {message.is_starred ? "Unstar" : "Star"}
                      </AdminButton>
                      <AdminButton
                        onClick={() => flag.mutate({ id: message.id, is_read: !message.is_read })}
                      >
                        Mark {message.is_read ? "unread" : "read"}
                      </AdminButton>
                      <a
                        href={`mailto:${message.email}?subject=Re: ${encodeURIComponent(message.subject)}`}
                        className="label-mono border border-border px-4 py-2.5 text-foreground hover:bg-accent"
                      >
                        Reply ↗
                      </a>
                      <AdminButton
                        variant="danger"
                        onClick={() => {
                          if (window.confirm("Delete this message?")) remove.mutate(message.id);
                        }}
                      >
                        Delete
                      </AdminButton>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}
