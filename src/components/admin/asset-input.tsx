import { useRef, useState } from "react";
import { toast } from "sonner";

import { AdminButton, adminInputClass } from "@/components/admin/ui";
import { uploadMedia } from "@/lib/cms/admin.functions";

/**
 * URL field with an inline upload shortcut. Uploads go through the media data
 * layer, so switching the storage backend (R2 later) only changes that layer.
 */
export function AssetInput({
  value,
  onChange,
  accept = "image/*",
  placeholder = "https://… or upload",
  preview = true,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  accept?: string;
  placeholder?: string;
  preview?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File is larger than 8 MB.");
      return;
    }
    setBusy(true);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      // Encode in 32 KB slices: building one string a byte at a time (millions of
      // concatenations for a multi-MB image) freezes the tab.
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < buffer.length; i += CHUNK) {
        binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
      }
      const asset = await uploadMedia({
        data: { name: file.name, mimeType: file.type, base64: btoa(binary) },
      });
      onChange(asset.url);
      toast.success("Uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className={`${adminInputClass} flex-1`}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
        />
        <AdminButton type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Uploading…" : "Upload"}
        </AdminButton>
        {value ? (
          <AdminButton type="button" variant="danger" onClick={() => onChange(null)}>
            Clear
          </AdminButton>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      {preview && value ? (
        <img
          src={value}
          alt="Selected asset preview"
          className="h-28 w-full max-w-xs border border-border object-cover"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
