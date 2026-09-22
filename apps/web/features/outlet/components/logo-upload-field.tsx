"use client";

import { useState } from "react";
import Image from "next/image";
import { FileUploader } from "@/components/file-uploader";
import { Field, FieldDescription, FieldError, FieldLabel } from "@pixa/ui/base-ui/field";
import { Button } from "@pixa/ui/base-ui/button";
import { useFieldContext, useFieldInvalid, type BaseFieldProps } from "@/lib/form-context";
import { toast } from "sonner";

/**
 * Outlet logo field: pick a file -> uploads immediately to Neon
 * `outlet-assets` (POST /api/outlet-logo) -> field value becomes the public
 * URL string. Saved logos render from URL, so File objects never reach the
 * outlet store (and the FileCard crash class stays dead).
 */
export function LogoUploadField({
  label,
  description,
  required,
  outletId,
}: BaseFieldProps & { outletId?: string }) {
  const field = useFieldContext<string | File[] | undefined>();
  const isInvalid = useFieldInvalid();
  const [uploading, setUploading] = useState(false);
  const [staged, setStaged] = useState<File[]>([]);

  const value = field.state.value;
  const url = typeof value === "string" && value ? value : undefined;

  async function handleFiles(files: File[]): Promise<void> {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("outlet_id", outletId ?? "default");
      const res = await fetch("/api/outlet-logo", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) throw new Error(data?.error ?? "Upload failed");
      field.handleChange(data.url);
      setStaged([]);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setStaged([]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>
        {label}
        {required && " *"}
      </FieldLabel>
      {url ? (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Image
            src={url}
            alt="Outlet logo"
            width={64}
            height={64}
            className="aspect-square shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-medium">Current logo</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">{url}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => field.handleChange("")}>
            Replace
          </Button>
        </div>
      ) : (
        <FileUploader
          value={staged}
          onValueChange={(files) => {
            const next = typeof files === "function" ? files(staged) : files;
            setStaged(next);
            if (next.length > 0) void handleFiles(next);
          }}
          maxSize={5 * 1024 * 1024}
          maxFiles={1}
        />
      )}
      {uploading && <FieldDescription>Uploading logo…</FieldDescription>}
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError id={`${field.name}-error`} errors={field.state.meta.errors} />}
    </Field>
  );
}
