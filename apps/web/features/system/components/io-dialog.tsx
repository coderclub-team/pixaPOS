"use client";

import { useRef, useState } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Icons } from "@pixa/ui/icons";
import { toast } from "sonner";
import { downloadCSV, toCSV, toTable, todayStamp, type CsvColumn } from "../lib/csv";

export type ImportResult = { created: number; updated: number; skipped: number; errors: string[] };

/** Export button: downloads the given rows as CSV. */
export function ExportButton<T>({
  filename,
  rows,
  columns,
}: {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => {
        downloadCSV(`${filename}-${todayStamp()}`, toCSV(rows, columns));
        toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
      }}
    >
      <Icons.download className="size-3.5" /> Export
    </Button>
  );
}

/**
 * Generic bulk-import dialog. `columns` define the contract: labels become the
 * sample-file headers, `parse` converts cells, and `onImport` upserts rows via
 * domain service commands (created vs updated counts reported back).
 */
export function ImportDialog<TParsed>({
  title,
  sampleFilename,
  columns,
  sampleRows,
  onImport,
  onDone,
  triggerLabel = "Import",
}: {
  title: string;
  sampleFilename: string;
  columns: CsvColumn<TParsed>[];
  sampleRows: Record<string, string>[];
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onDone?: () => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadSample = () => {
    const header = columns.map((c) => c.label).join(",");
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = sampleRows.map((r) => columns.map((c) => esc(r[c.key] ?? "")).join(","));
    downloadCSV(`${sampleFilename}-sample`, header + "\r\n" + lines.join("\r\n") + "\r\n");
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const { headers, rows } = toTable(await f.text());
    const required = columns.filter((c) => c.required).map((c) => c.label);
    const absent = required.filter((h) => !headers.includes(h));
    setMissing(absent);
    setPreview(rows);
    setFileName(f.name);
  };

  const run = async () => {
    setBusy(true);
    try {
      const res = await onImport(preview);
      setBusy(false);
      setOpen(false);
      setPreview([]);
      setFileName(null);
      if (res.errors.length > 0) {
        toast.warning(
          `Imported with issues: ${res.created} new, ${res.updated} updated, ${res.skipped} skipped — ${res.errors.slice(0, 2).join("; ")}${res.errors.length > 2 ? ` (+${res.errors.length - 2} more)` : ""}`,
        );
      } else {
        toast.success(`Import done: ${res.created} new, ${res.updated} updated`);
      }
      onDone?.();
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  const canRun = preview.length > 0 && missing.length === 0 && !busy;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Icons.upload className="size-3.5" /> {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Upload a CSV matching the sample format. Existing records (matched by code/phone/name)
              are updated, new rows are created.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadSample}>
              <Icons.download className="size-3.5" /> Download sample CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Icons.upload className="size-3.5" /> Choose file…
            </Button>
            {fileName && (
              <span className="text-xs text-muted-foreground">
                {fileName} · {preview.length} rows
              </span>
            )}
          </div>
          {missing.length > 0 && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Missing required columns: {missing.join(", ")}
            </p>
          )}
          {preview.length > 0 && missing.length === 0 && (
            <div className="max-h-56 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    {columns.map((c) => (
                      <th key={c.key} className="px-2 py-1.5 text-left font-semibold">
                        {c.label}
                        {c.required && <span className="text-destructive"> *</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">
                      {columns.map((c) => (
                        <td key={c.key} className="max-w-32 truncate px-2 py-1.5">
                          {r[c.label] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 5 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  …and {preview.length - 5} more rows
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={run} disabled={!canRun}>
              {busy ? "Importing…" : `Import ${preview.length} rows`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
