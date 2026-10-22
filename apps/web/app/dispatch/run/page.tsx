import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardSkeleton } from "@pixa/ui/base-ui/board-skeleton";
import { requireBaUser } from "@pixa/server";
import RunSheet from "./run-sheet";

export const metadata: Metadata = {
  title: "Delivery Run Sheet",
  description: "Rider runs — addresses, COD collection, mark delivered.",
};

export default async function DispatchRunPage() {
  await requireBaUser();
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <RunSheet />
    </Suspense>
  );
}
