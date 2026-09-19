"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * Upload a File to Neon Object Storage via /api/uploads. Returns the durable
 * object key, or null on failure (caller keeps any existing URL). Shows an
 * instant blob preview URL through onPreview while the upload runs.
 */
export function useImageUpload(kind: string) {
  const [uploading, setUploading] = useState(false);

  const upload = async (
    file: File,
    opts?: { onPreview?: (blobUrl: string) => void },
  ): Promise<string | null> => {
    const preview = URL.createObjectURL(file);
    opts?.onPreview?.(preview);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      const key: string = body.key;
      // Resolve to a viewable URL now so callers store a working URL, not a key.
      const view = await fetch(`/api/uploads?key=${encodeURIComponent(key)}`).then((r) => r.json());
      return (view.url as string) ?? null;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
