import type { Metadata } from "next";
import { Suspense } from "react";
import PosShell, { PosShellSkeleton } from "../shell";
import { requireBaUser } from "@pixa/server";
import { requireTerminalOutlet } from "@/lib/terminal-outlet";
import { OutletRouteSync } from "@/components/outlet-route-sync";

export const metadata: Metadata = {
  title: "POS Terminal",
  description: "Standalone order terminal — dine-in, counter, takeaway and delivery.",
};

export default async function PosOutletPage({ params }: { params: Promise<{ outlet: string }> }) {
  await requireBaUser();
  const { outlet } = await params;
  const terminal = await requireTerminalOutlet(outlet, "pos");
  return (
    <Suspense fallback={<PosShellSkeleton />}>
      <OutletRouteSync outletId={terminal.id}>
        <PosShell />
      </OutletRouteSync>
    </Suspense>
  );
}
