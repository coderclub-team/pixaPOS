import { redirect } from "next/navigation";
import { requireBaUser } from "@pixa/server";
import { listTerminalOutlets } from "@/lib/terminal-outlet";
import { EnsureOutletDialog } from "@/components/ensure-outlet-dialog";

export const metadata = {
  title: "KDS Wallboard",
  description: "Live kitchen display — installable, works offline.",
};

/**
 * Bare /kds: pick an outlet, then land on /kds/CODE where the wallboard
 * runs outlet-scoped. Single-outlet users skip the picker entirely.
 */
export default async function KdsPage() {
  await requireBaUser();
  const { single } = await listTerminalOutlets("kds");
  if (single) redirect(`/kds/${single.code}`);
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <EnsureOutletDialog basePath="/kds" mode="list" />
    </div>
  );
}
