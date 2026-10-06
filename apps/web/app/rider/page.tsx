import type { Metadata } from "next";
import { Suspense } from "react";
import { requireBaUser } from "@/lib/auth-session";
import RiderShell from "./shell";

export const metadata: Metadata = {
  title: "Rider",
  manifest: "/rider/manifest.webmanifest",
  description: "Rider runs — my assigned deliveries, COD, handover.",
};

export default async function RiderPage() {
  await requireBaUser();
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading rider…</div>}>
      <RiderShell />
    </Suspense>
  );
}
