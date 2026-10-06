/**
 * CSV import/export primitives. RFC-4180 quoting; no dependencies.
 * Samples double as the documented column contract for bulk import.
 */

export type CsvColumn<T> = {
  key: string;
  label: string;
  required?: boolean;
  /** Row → cell string for export. */
  get?: (row: T) => string | number | boolean | null | undefined;
  /** Cell string → value for import (default: trimmed string). */
  parse?: (cell: string) => unknown;
};

function esc(cell: string): string {
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function toCSV<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => esc(c.label)).join(",");
  const lines = rows.map((r) =>
    columns
      .map((c) => {
        const v = c.get?.(r);
        if (v == null) return "";
        if (typeof v === "boolean") return v ? "yes" : "no";
        return esc(String(v));
      })
      .join(","),
  );
  return [head, ...lines].join("\r\n") + "\r\n";
}

/** Minimal RFC-4180 parser: quoted fields, escaped quotes, CRLF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const t = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // skip — \n handles the break
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (!(row.length === 1 && row[0] === "")) rows.push(row);
  return rows;
}

export type ParsedTable = { headers: string[]; rows: Record<string, string>[] };

export function toTable(text: string): ParsedTable {
  const grid = parseCSV(text);
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = grid[0].map((h) => h.trim());
  const rows = grid.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = (cells[i] ?? "").trim();
    });
    return rec;
  });
  return { headers, rows };
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseYesNo(cell: string): boolean {
  return ["yes", "y", "true", "1", "active"].includes(cell.trim().toLowerCase());
}

export function parseNumber(cell: string): number | undefined {
  if (cell.trim() === "") return undefined;
  const n = Number(cell.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}
