import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AdminButton, AdminPage, EmptyState } from "@/components/admin/ui";
import {
  deleteMedia,
  deleteR2Object,
  importR2Object,
  listMedia,
  listR2Objects,
  uploadMedia,
} from "@/lib/cms/admin.functions";

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
  const [showRecovery, setShowRecovery] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["admin-media"],
    queryFn: () => listMedia(),
  });

  const { data: r2Objects = [], isLoading: r2Loading } = useQuery({
    queryKey: ["admin-r2-objects"],
    queryFn: () => listR2Objects(),
    enabled: showRecovery,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-media"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-r2-objects"] }),
    ]);

  const remove = useMutation({
    mutationFn: (id: string) => deleteMedia({ data: { id } }),
    onSuccess: async () => {
      toast.success("Asset deleted.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importObject = useMutation({
    mutationFn: (path: string) => importR2Object({ data: { path } }),
    onSuccess: async (result) => {
      toast.success(result.alreadyImported ? "Already in the library." : "Recovered into the library.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeR2 = useMutation({
    mutationFn: (path: string) => deleteR2Object({ data: { path } }),
    onSuccess: async () => {
      toast.success("Deleted from storage.");
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
        <>
          <AdminButton onClick={() => setShowRecovery((v) => !v)}>
            {showRecovery ? "Hide storage browser" : "Recover from storage"}
          </AdminButton>
          <AdminButton variant="primary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Uploading…" : "Upload files"}
          </AdminButton>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      {showRecovery ? (
        <div className="mb-10 border border-border bg-card p-5">
          <p className="label-mono text-foreground">Raw storage browser</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Lists every object actually sitting in R2 storage, independent of the library above.
            R2 files are never deleted just because the database was wiped or restored - use this
            to pull anything the library has forgotten back in, or to permanently remove files that
            don't belong anywhere anymore.
          </p>
          {r2Loading ? (
            <p className="label-mono mt-4 text-muted-foreground">Scanning storage…</p>
          ) : r2Objects.length === 0 ? (
            <p className="label-mono mt-4 text-muted-foreground">Storage bucket is empty.</p>
          ) : (
            <div className="mt-4 divide-y divide-border border border-border">
              {r2Objects.map((object) => (
                <div key={object.path} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                    {object.path}
                  </span>
                  <span className="label-mono text-muted-foreground">
                    {formatBytes(object.size)}
                  </span>
                  <span
                    className={
                      object.knownInDb
                        ? "label-mono bg-signal px-2 py-1 text-signal-foreground"
                        : "label-mono border border-destructive px-2 py-1 text-destructive"
                    }
                  >
                    {object.knownInDb ? "In library" : "Not in library"}
                  </span>
                  {!object.knownInDb ? (
                    <AdminButton
                      onClick={() => importObject.mutate(object.path)}
                      disabled={importObject.isPending}
                    >
                      Recover
                    </AdminButton>
                  ) : null}
                  <AdminButton
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Permanently delete ${object.path} from storage?`)) {
                        removeR2.mutate(object.path);
                      }
                    }}
                  >
                    Delete
                  </AdminButton>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
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
