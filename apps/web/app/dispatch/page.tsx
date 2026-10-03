import type { Metadata } from "next";
import { Suspense } from "react";
import { requireBaUser } from "@/lib/auth-session";
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
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading dispatch…</div>}>
      <DispatchBoard />
    </Suspense>
  );
}
