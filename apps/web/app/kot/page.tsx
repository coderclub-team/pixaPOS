import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBaUser } from "@/lib/auth-session";
import { listTerminalOutlets } from "@/lib/terminal-outlet";
import { EnsureOutletDialog } from "@/components/ensure-outlet-dialog";

export const metadata: Metadata = {
  title: "KOT",
  description: "Waiter ordering — reserved for the upcoming KOT-focused interface.",
};

/**
 * Bare /kot: pick an outlet, then land on /kot/CODE. Single-outlet users
 * skip the picker entirely.
 */
export default async function KotPage() {
  await requireBaUser();
  const { single } = await listTerminalOutlets("kot");
  if (single) redirect(`/kot/${single.code}`);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-bold">KOT — coming soon</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        This route is reserved for waiter ordering. The counter terminal now runs at /pos.
      </p>
      <Link
        href="/pos"
        className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Open POS terminal
      </Link>
      <EnsureOutletDialog basePath="/kot" mode="list" />
    </div>
  );
}
