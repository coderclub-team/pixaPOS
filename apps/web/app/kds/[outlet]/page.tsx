import { Suspense } from "react";
import { requireBaUser } from "@pixa/server";
import { BoardSkeleton } from "@pixa/ui/base-ui/board-skeleton";
import { requireTerminalOutlet } from "@/lib/terminal-outlet";
import { OutletRouteSync } from "@/components/outlet-route-sync";
import KdsWallboard from "../wallboard";

export const metadata = {
  title: "KDS Wallboard",
  description: "Live kitchen display — installable, works offline.",
};

export default async function KdsOutletPage({ params }: { params: Promise<{ outlet: string }> }) {
  await requireBaUser();
  const { outlet } = await params;
  const terminal = await requireTerminalOutlet(outlet, "kds");
  return (
    <OutletRouteSync outletId={terminal.id}>
      <Suspense fallback={<BoardSkeleton />}>
        <KdsWallboard />
      </Suspense>
    </OutletRouteSync>
  );
}
