import type { Metadata } from "next";
import Link from "next/link";
import { requireBaUser } from "@/lib/auth-session";

export const metadata: Metadata = {
  title: "KOT",
  description: "Waiter ordering — reserved for the upcoming KOT-focused interface.",
};

/**
 * /kot placeholder: this route is reserved for the future waiter-ordering
 * (KOT-focused) interface. The current counter terminal lives at /pos.
 */
export default async function KotPlaceholderPage() {
  await requireBaUser();
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
    </div>
  );
}
