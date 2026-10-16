"use client";

import { useMemo, useState } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";

export type SortDir = "asc" | "desc";

/**
 * Shared asc/desc sorting for every dashboard table. Tables keep their own
 * filters; this hook only orders the already-filtered rows. `getters` maps a
 * column key to a comparable (string | number | boolean | null).
 */
export function useSorting<T>(initialKey: string, initialDir: SortDir = "asc") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const toggle = (key: string) =>
    setSortKey((prev) => {
      if (prev !== key) {
        setSortDir("asc");
        return key;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });

  const sorted = useMemo(
    () =>
      (
        rows: T[],
        getters: Record<string, (row: T) => string | number | boolean | null | undefined>,
      ) => {
        const get = getters[sortKey];
        if (!get) return rows;
        const dir = sortDir === "asc" ? 1 : -1;
        return [...rows].sort((a, b) => {
          const av = get(a);
          const bv = get(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
          if (typeof av === "boolean" && typeof bv === "boolean")
            return (Number(av) - Number(bv)) * dir;
          return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
        });
      },
    [sortKey, sortDir],
  );

  return { sortKey, sortDir, toggle, sorted };
}

/** Clickable column header with direction indicator. */
export function SortTh({
  label,
  column,
  sortKey,
  sortDir,
  onToggle,
  className,
}: {
  label: string;
  column: string;
  sortKey: string;
  sortDir: SortDir;
  onToggle: (column: string) => void;
  className?: string;
}) {
  const active = sortKey === column;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggle(column)}
      aria-label={`Sort by ${label} ${active && sortDir === "asc" ? "descending" : "ascending"}`}
      className={cn("-ml-2 h-8 gap-1 px-2 text-xs font-semibold", className)}
    >
      {label}
      <Icons.chevronsUpDown
        className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")}
      />
      {active && (
        <span className="text-[10px] text-primary" aria-hidden>
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      )}
    </Button>
  );
}
