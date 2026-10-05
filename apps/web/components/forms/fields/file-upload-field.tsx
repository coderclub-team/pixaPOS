"use client";

import Image from "next/image";
import { FileUploader } from "@/components/file-uploader";
import { Field, FieldDescription, FieldError, FieldLabel } from "@pixa/ui/base-ui/field";
import { Button } from "@pixa/ui/base-ui/button";
import { useFieldContext, useFieldInvalid, type BaseFieldProps } from "@/lib/form-context";

export function FileUploadField({
  label,
  description,
  required,
  maxSize = 5 * 1024 * 1024,
  maxFiles = 1,
}: BaseFieldProps & {
  maxSize?: number;
  maxFiles?: number;
}) {
  const field = useFieldContext<File[] | string | undefined>();
  const isInvalid = useFieldInvalid();
  const value = field.state.value;
  // Saved URL string (e.g. outlet logo): preview + clear instead of uploader.
  const savedUrl = typeof value === "string" && value ? value : undefined;

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>
        {label}
        {required && " *"}
      </FieldLabel>
      {savedUrl ? (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Image
            src={savedUrl}
            alt={label ?? "Uploaded file"}
            width={64}
            height={64}
            className="aspect-square shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-medium">Current file</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">{savedUrl}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => field.handleChange([])}>
            Replace
          </Button>
        </div>
      ) : (
        <FileUploader
          value={Array.isArray(value) ? value : undefined}
          onValueChange={(files) =>
            field.handleChange(
              typeof files === "function" ? files(Array.isArray(value) ? value : []) : files,
            )
          }
          maxSize={maxSize}
          maxFiles={maxFiles}
        />
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError id={`${field.name}-error`} errors={field.state.meta.errors} />}
    </Field>
  );
}
