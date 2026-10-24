import { Suspense } from "react";
import { requireBaUser } from "@pixa/server";
import { BoardSkeleton } from "@pixa/ui/base-ui/board-skeleton";
import { requireTerminalOutletById } from "@/lib/terminal-outlet";
import { OutletRouteSync } from "@/components/outlet-route-sync";
import KdsWallboard from "@/app/kds/wallboard";

export const metadata = {
  title: "KDS Wallboard",
  description: "Live kitchen display — org + outlet scoped.",
};

export default async function KdsOutletScopedPage({
  params,
}: {
  params: Promise<{ orgId: string; outletId: string }>;
}) {
  await requireBaUser();
  const { orgId, outletId } = await params;
  const terminal = await requireTerminalOutletById(orgId, outletId, "kds");
  return (
    <OutletRouteSync outletId={terminal.id}>
      <Suspense fallback={<BoardSkeleton />}>
        <KdsWallboard fallbackOutlet={terminal} />
      </Suspense>
    </OutletRouteSync>
  );
}
