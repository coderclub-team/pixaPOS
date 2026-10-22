import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardSkeleton } from "@pixa/ui/base-ui/board-skeleton";
import { requireBaUser } from "@pixa/server";
import RiderShell from "./shell";

export const metadata: Metadata = {
  title: "Rider",
  manifest: "/rider/manifest.webmanifest",
  description: "Rider runs — my assigned deliveries, COD, handover.",
};

export default async function RiderPage() {
  await requireBaUser();
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <RiderShell />
    </Suspense>
  );
}
