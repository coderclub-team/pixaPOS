"use client";

import Link from "next/link";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { cn } from "@pixa/ui/lib/utils";

/**
 * Inline CTA shown when a create form has no active outlet. Every
 * outlet-owned entity (floors, tables, …) requires one — the user picks or
 * creates it in Settings → Outlets instead of silently writing a null outlet.
 */
export function OutletRequiredCallout({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
      <p className="font-medium">Select an outlet first</p>
      <p className="mt-0.5 text-muted-foreground">
        {what} belong to an outlet. Select one or create your first outlet to continue.
      </p>
      <Link
        href="/dashboard/settings/outlets"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2")}
      >
        Go to Outlets
      </Link>
    </div>
  );
}
