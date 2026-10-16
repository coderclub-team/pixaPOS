import type { Metadata } from "next";
import { Suspense } from "react";
import { requireBaUser } from "@pixa/server";
import { requireTerminalOutlet } from "@/lib/terminal-outlet";
import { OutletRouteSync } from "@/components/outlet-route-sync";
import PosShell from "../shell";

export const metadata: Metadata = {
  title: "POS Terminal",
  description: "Standalone order terminal — dine-in, counter, takeaway and delivery.",
};

export default async function PosOutletPage({ params }: { params: Promise<{ outlet: string }> }) {
  await requireBaUser();
  const { outlet } = await params;
  const terminal = await requireTerminalOutlet(outlet, "pos");
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading terminal…</div>}>
      <OutletRouteSync outletId={terminal.id}>
        <PosShell />
      </OutletRouteSync>
    </Suspense>
  );
}
