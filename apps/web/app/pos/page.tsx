import type { Metadata } from "next";
import { Suspense } from "react";
import { requireBaUser } from "@/lib/auth-session";
import PosShell from "./shell";

export const metadata: Metadata = {
  title: "POS Terminal",
  description: "Standalone order terminal — dine-in, counter, takeaway and delivery.",
};

export default async function PosPage() {
  // Same gate as /kds: live order and payment data, never anonymous.
  await requireBaUser();
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading terminal…</div>}>
      <PosShell />
    </Suspense>
  );
}
