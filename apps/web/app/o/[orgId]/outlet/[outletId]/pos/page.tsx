import type { Metadata } from "next";
import { Suspense } from "react";
import PosShell, { PosShellSkeleton } from "@/app/pos/shell";
import { requireBaUser } from "@pixa/server";
import { requireTerminalOutletById } from "@/lib/terminal-outlet";
import { OutletRouteSync } from "@/components/outlet-route-sync";

export const metadata: Metadata = {
  title: "POS Terminal",
  description: "Standalone order terminal — org + outlet scoped.",
};

export default async function PosOutletScopedPage({
  params,
}: {
  params: Promise<{ orgId: string; outletId: string }>;
}) {
  await requireBaUser();
  const { orgId, outletId } = await params;
  const terminal = await requireTerminalOutletById(orgId, outletId, "pos");
  return (
    <Suspense fallback={<PosShellSkeleton />}>
      <OutletRouteSync outletId={terminal.id}>
        <PosShell fallbackOutlet={terminal} />
      </OutletRouteSync>
    </Suspense>
  );
}
