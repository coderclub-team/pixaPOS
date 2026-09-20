import type { Metadata } from "next";
import { Suspense } from "react";
import { requireBaUser } from "@/lib/auth-session";
import KotShell from "./shell";

export const metadata: Metadata = {
  title: "KOT Counter",
  description: "Standalone order terminal — fire KOTs, bill and collect.",
};

export default async function KotPage() {
  // Same gate as /kds: live order and payment data, never anonymous.
  await requireBaUser();
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading terminal…</div>}>
      <KotShell />
    </Suspense>
  );
}
