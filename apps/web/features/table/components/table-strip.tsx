"use client";

import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { partyHex } from "../api/utils";
import type { TableWithDerived } from "../api/types";

/**
 * Compact table identity strip: chair icon + table/party label + seat fill +
 * status pill + party dots. The whole strip opens the ops dialog; party dots
 * focus a party directly. Displayed at the top of the bill so floor state is
 * readable without scrolling into bill content.
 */
export default function TableStrip({
  table,
  activeGroupId,
  onOpenOps,
  onSelectParty,
}: {
  table: TableWithDerived;
  activeGroupId?: string | null;
  onOpenOps: () => void;
  onSelectParty?: (groupId: string) => void;
}) {
  const activeGroup = table.active_groups.find((g) => g.id === activeGroupId) ?? null;
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5">
      <button
        type="button"
        onClick={onOpenOps}
        title="Open table ops — parties, block, status"
        aria-label={`Open table ops for table ${table.number}`}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border">
          <Icons.party className="size-4 text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">
            Table {table.number}
            {activeGroup ? ` · Party ${activeGroup.label ?? "?"}` : ""}
          </span>
          <span className="block text-[11px] leading-tight text-muted-foreground">
            {table.seated_seats}/{table.capacity} seated
            {table.active_block ? " · blocked" : ""}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
            table.status === "available" &&
              "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
            table.status === "occupied" &&
              "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
            table.status === "reserved" &&
              "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
            table.status === "cleaning" &&
              "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
            table.status === "out_of_service" &&
              "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
          )}
        >
          {table.status.replace("_", " ")}
        </span>
      </button>
      {table.active_groups.length > 0 && (
        <span
          className="flex shrink-0 items-center gap-1"
          role="group"
          aria-label="Parties on this table"
        >
          {table.active_groups.slice(0, 4).map((g, i) => (
            <button
              key={g.id}
              type="button"
              disabled={!onSelectParty}
              onClick={(e) => {
                e.stopPropagation();
                onSelectParty?.(g.id);
              }}
              title={`Party ${g.label ?? "?"} · ${g.seats} guest${g.seats === 1 ? "" : "s"}${g.order_id ? " · order open" : ""}`}
              aria-label={`Party ${g.label ?? "?"}, ${g.seats} guests`}
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-offset-1 ring-offset-background transition-transform hover:scale-110",
                g.id === activeGroupId ? "ring-primary" : "ring-transparent",
              )}
              style={{ backgroundColor: partyHex(g.color_index ?? i) }}
            >
              {g.label ?? "?"}
            </button>
          ))}
          {table.active_groups.length > 4 && (
            <span className="text-[11px] text-muted-foreground">
              +{table.active_groups.length - 4}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
