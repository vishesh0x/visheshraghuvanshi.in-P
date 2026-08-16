import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AdminButton, AdminPage, EmptyState } from "@/components/admin/ui";
import { deleteMedia, listMedia, uploadMedia } from "@/lib/cms/admin.functions";

export const Route = createFileRoute("/admin/media")({
  component: MediaPage,
});

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function MediaPage() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["admin-media"],
    queryFn: () => listMedia(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-media"] });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMedia({ data: { id } }),
    onSuccess: async () => {
      toast.success("Asset deleted.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 8 MB.`);
          continue;
        }
        const buffer = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const byte of buffer) binary += String.fromCharCode(byte);
        await uploadMedia({
          data: { name: file.name, mimeType: file.type, base64: btoa(binary) },
        });
      }
      toast.success("Upload complete.");
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <AdminPage
      title="Assets"
      description="Private object storage with a stable public proxy URL for every file - paste those URLs into project covers."
      actions={
        <AdminButton variant="primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Uploading…" : "Upload files"}
        </AdminButton>
      }
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      {isLoading ? (
        <p className="label-mono text-muted-foreground">Loading assets…</p>
      ) : assets.length === 0 ? (
        <EmptyState message="No assets uploaded yet." />
      ) : (
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-card">
              {asset.mime_type.startsWith("image/") ? (
                <img
                  src={asset.url}
                  alt={asset.name}
                  loading="lazy"
                  className="aspect-[4/3] w-full border-b border-border object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center border-b border-border">
                  <span className="label-mono text-muted-foreground">{asset.mime_type}</span>
                </div>
              )}
              <div className="p-4">
                <p className="truncate font-mono text-xs text-foreground">{asset.name}</p>
                <p className="label-mono mt-2 text-muted-foreground">
                  {formatBytes(asset.size_bytes)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminButton
                    onClick={() => {
                      void navigator.clipboard.writeText(asset.url);
                      toast.success("URL copied.");
                    }}
                  >
                    Copy URL
                  </AdminButton>
                  <AdminButton
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Delete ${asset.name}?`)) remove.mutate(asset.id);
                    }}
                  >
                    Delete
                  </AdminButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
