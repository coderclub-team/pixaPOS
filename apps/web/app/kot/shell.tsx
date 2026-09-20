"use client";

import Link from "next/link";
import { Button } from "@pixa/ui/base-ui/button";
import OrderTerminalPage from "@/features/table/components/order-terminal-view";

/**
 * Standalone KOT counter: the full order terminal (floor + bill + payments)
 * without the dashboard shell. Mount on a counter tablet, sign in once.
 */
export default function KotShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
        <Link href="/dashboard/overview" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="pixaPOS" className="size-full object-cover" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold">pixaPOS · KOT</span>
            <span className="block text-[11px] text-muted-foreground">
              Fire tickets, bill and collect
            </span>
          </span>
        </Link>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/order-terminal" />}
        >
          Dashboard
        </Button>
      </header>
      <main className="flex-1 overflow-y-auto p-3">
        <OrderTerminalPage hideDescription hideTitle />
      </main>
    </div>
  );
}
