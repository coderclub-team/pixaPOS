import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBaUser } from "@/lib/auth-session";
import { listTerminalOutlets } from "@/lib/terminal-outlet";
import { EnsureOutletDialog } from "@/components/ensure-outlet-dialog";

export const metadata: Metadata = {
  title: "POS Terminal",
  description: "Standalone order terminal — dine-in, counter, takeaway and delivery.",
};

/**
 * Bare /pos: pick an outlet, then land on /pos/CODE where the terminal
 * runs outlet-scoped. Single-outlet users skip the picker entirely.
 */
export default async function PosPage() {
  await requireBaUser();
  const { single } = await listTerminalOutlets("pos");
  if (single) redirect(`/pos/${single.code}`);
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <EnsureOutletDialog basePath="/pos" mode="list" />
    </div>
  );
}
