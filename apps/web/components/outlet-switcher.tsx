"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from "@pixa/ui/base-ui/select";
import { Icons } from "@pixa/ui/icons";
import {
  outletKeys,
  outletsQueryOptions,
  setActiveOutletId,
  swapOutletSegment,
} from "@/features/outlet/api/queries";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { getQueryClient } from "@/lib/query-client";

/**
 * Header outlet switcher built on base-ui Select (same pattern as
 * ThemeSelector). Rows are two-line (name / code) with an automatic
 * trailing tick on the selected outlet via SelectItem's ItemIndicator.
 */
export function OutletSwitcher() {
  // First client render must match SSR exactly: the resolved outlet depends
  // on localStorage + async queries (both absent/null on the server), and
  // Base UI toggles data-placeholder off once a value exists — a guaranteed
  // hydration mismatch without this gate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { data: outlets, isPending } = useQuery(outletsQueryOptions);
  // Scope to the caller's assigned outlets (admins see all). Falls back to
  // the full org list while loading or when the endpoint is unavailable.
  const { data: access } = useQuery({
    queryKey: ["me", "outlets"],
    queryFn: async (): Promise<{ outlets?: { id: string }[] }> => {
      try {
        const res = await fetch("/api/me/outlets", { credentials: "include" });
        if (!res.ok) return {};
        return (await res.json()) as { outlets?: { id: string }[] };
      } catch {
        return {};
      }
    },
    staleTime: 60_000,
  });
  const all = outlets ?? [];
  const allowed = access?.outlets;
  const list = allowed ? all.filter((o) => allowed.some((a) => a.id === o.id)) : all;
  const router = useRouter();
  const pathname = usePathname();
  const activeOutletId = useActiveOutletId();
  const activeId = mounted ? (activeOutletId ?? list[0]?.id ?? all[0]?.id ?? null) : null;
  const active = mounted ? (all.find((o) => o.id === activeId) ?? list[0] ?? all[0]) : undefined;
  const activeCode = active?.code ?? "—";

  const switchTo = (value: string | null) => {
    if (value === null) return;
    if (value === "__manage") {
      router.push("/dashboard/settings/outlets");
      return;
    }
    if (!value || value === activeId || value.startsWith("__")) return;
    const chosen = all.find((o) => o.id === value);
    if (!chosen) return;
    setActiveOutletId(value, pathname);
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: outletKeys.list() });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["kitchen"] });
    qc.invalidateQueries({ queryKey: ["tables"] });
    qc.invalidateQueries({ queryKey: ["floors"] });
    qc.invalidateQueries({ queryKey: ["menu"] });
    // On outlet-scoped routes (/pos/<id>, /kds/<id>, …) the URL owns the
    // outlet via OutletRouteSync — it would instantly revert a storage-only
    // switch. Navigate with the new id so URL and storage converge.
    if (activeId) {
      const next = swapOutletSegment(pathname, activeId, value);
      if (next) router.replace(next);
    }
    toast.success(`Switched this terminal to ${chosen.name}`);
  };

  return (
    <Select
      items={list.map((o) => ({ value: o.id, label: o.name }))}
      value={activeId}
      onValueChange={switchTo}
    >
      <SelectTrigger
        id="outlet-selector"
        aria-label={`Switch outlet (currently ${active?.name ?? "none"})`}
        className="justify-start gap-1 font-mono text-xs font-semibold"
      >
        <span>{activeCode}</span>
        <Icons.chevronDown className="text-muted-foreground size-3.5" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          <SelectLabel>Outlets</SelectLabel>
          {isPending ? (
            <SelectItem value="__loading" disabled>
              Loading outlets…
            </SelectItem>
          ) : list.length === 0 ? (
            <SelectItem value="__empty" disabled>
              No outlets yet
            </SelectItem>
          ) : (
            list.map((o) => (
              <SelectItem key={o.id} value={o.id} disabled={!o.is_active}>
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="font-medium">{o.name}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {o.code}
                    {!o.is_active ? " · Inactive" : ""}
                  </span>
                </span>
              </SelectItem>
            ))
          )}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectItem value="__manage">
            <span className="flex items-center gap-1 text-sm font-medium">
              Manage outlets
              <Icons.chevronRight className="text-muted-foreground h-3.5 w-3.5" />
            </span>
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
