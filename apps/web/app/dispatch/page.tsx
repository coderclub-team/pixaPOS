import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardSkeleton } from "@pixa/ui/base-ui/board-skeleton";
import { requireBaUser } from "@pixa/server";
import DispatchBoard from "./board";

export const metadata: Metadata = {
  title: "Dispatch Console",
  manifest: "/dispatch/manifest.webmanifest",
  description: "Delivery dispatch — pack, assign riders and send orders out.",
};

export default async function DispatchPage() {
  // Same gate as /kds: live order data, never anonymous.
  await requireBaUser();
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <DispatchBoard />
    </Suspense>
  );
}
