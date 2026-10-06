import type { Metadata } from "next";
import { Suspense } from "react";
import { requireBaUser } from "@/lib/auth-session";
import RunSheet from "./run-sheet";

export const metadata: Metadata = {
  title: "Delivery Run Sheet",
  description: "Rider runs — addresses, COD collection, mark delivered.",
};

export default async function DispatchRunPage() {
  await requireBaUser();
  return (
    <Suspense
      fallback={<div className="p-4 text-sm text-muted-foreground">Loading run sheet…</div>}
    >
      <RunSheet />
    </Suspense>
  );
}
