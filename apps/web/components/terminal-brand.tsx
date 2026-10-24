"use client";

import { useQuery } from "@tanstack/react-query";
import { Icons } from "@pixa/ui/icons";
import { Skeleton } from "@pixa/ui/base-ui/skeleton";
import { useIdentity } from "@/hooks/use-identity";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { cn } from "@pixa/ui/lib/utils";

type TerminalBrandProps = {
  fallbackOutlet?: { id: string; name: string; code: string; organizationId: string } | null;
  surfaceLabel?: string;
  className?: string;
};

/**
 * Clean terminal identity: org + outlet with code badge and status dot.
 * Uses the active outlet (via OutletRouteSync) and the active org from
 * useIdentity. Server-passed fallbackOutlet avoids a flash while the outlet
 * query hydrates.
 */
export function TerminalBrand({ fallbackOutlet, surfaceLabel, className }: TerminalBrandProps) {
  const { organization } = useIdentity();
  const { data: outlet, isPending } = useQuery(outletQueryOptions);

  const effOutlet = outlet ?? fallbackOutlet ?? null;
  const orgName = organization?.name ?? null;

  if (isPending && !effOutlet) {
    return (
      <span className={cn("flex items-center gap-2", className)}>
        <Skeleton className="size-8 rounded-lg" />
        <span className="grid gap-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-32" />
        </span>
      </span>
    );
  }

  if (!effOutlet && !orgName && !surfaceLabel) {
    return (
      <span className={cn("flex items-center gap-2", className)}>
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
          <Icons.warehouse className="size-4 text-muted-foreground" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold">Terminal</span>
          <span className="block text-[11px] text-muted-foreground">Select an outlet</span>
        </span>
      </span>
    );
  }

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icons.warehouse className="size-4" />
      </span>
      <span className="grid leading-tight">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {orgName ? <span className="truncate max-w-[14ch]">{orgName}</span> : null}
          {orgName && effOutlet ? <span className="opacity-40">·</span> : null}
          {surfaceLabel ? <span>{surfaceLabel}</span> : null}
          {!orgName && !surfaceLabel && effOutlet ? <span>Outlet</span> : null}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">
            {effOutlet?.name ?? orgName ?? "Terminal"}
          </span>
          {effOutlet?.code ? (
            <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide">
              {effOutlet.code}
            </span>
          ) : null}
          {effOutlet ? <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden title="Active" /> : null}
        </span>
      </span>
    </span>
  );
}


