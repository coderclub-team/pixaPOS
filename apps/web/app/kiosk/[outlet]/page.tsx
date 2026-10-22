import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardSkeleton } from "@pixa/ui/base-ui/board-skeleton";
import { resolvePublicOutlet } from "@/lib/terminal-outlet";
import { OutletRouteSync } from "@/components/outlet-route-sync";
import KioskShell from "../shell";

export const metadata: Metadata = {
  title: "Kiosk",
  description: "Self-ordering kiosk — coming soon.",
};

/**
 * /kiosk/CODE placeholder (public — customers never sign in). Codes are
 * globally unique so no org context is needed to resolve the outlet.
 */
export default async function KioskOutletPage({ params }: { params: Promise<{ outlet: string }> }) {
  const { outlet } = await params;
  const terminal = await resolvePublicOutlet(outlet);
  return (
    <OutletRouteSync outletId={terminal.id}>
      <Suspense fallback={<BoardSkeleton />}>
        <KioskShell>
          <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-lg font-bold">Self-ordering — coming soon</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {terminal.name} ({terminal.code}): browse the menu, build a cart and pay.
            </p>
          </div>
        </KioskShell>
      </Suspense>
    </OutletRouteSync>
  );
}
