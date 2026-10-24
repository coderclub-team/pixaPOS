import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { BoardSkeleton } from "@pixa/ui/base-ui/board-skeleton";
import { requireBaUser } from "@pixa/server";
import { requireTerminalOutlet } from "@/lib/terminal-outlet";
import { OutletRouteSync } from "@/components/outlet-route-sync";
import { TerminalBrand } from "@/components/terminal-brand";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@pixa/ui/base-ui/sidebar";
import AppSidebar from "@/components/layout/app-sidebar";

export const metadata: Metadata = {
  title: "KOT",
  description: "Waiter ordering — reserved for the upcoming KOT-focused interface.",
};

/**
 * /kot/CODE placeholder (outlet-resolved): same upcoming waiter-ordering
 * surface, bound to an authorized outlet like every other terminal.
 */
export default async function KotOutletPage({ params }: { params: Promise<{ outlet: string }> }) {
  await requireBaUser();
  const { outlet } = await params;
  const terminal = await requireTerminalOutlet(outlet, "kot");
  return (
    <OutletRouteSync outletId={terminal.id}>
      <Suspense fallback={<BoardSkeleton />}>
        <SidebarProvider defaultOpen={false}>
          <AppSidebar />
          <SidebarInset>
            <div className="flex h-dvh flex-col overflow-hidden bg-background">
              <header className="flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2">
                <span className="flex items-center gap-2">
                  <SidebarTrigger className="-ml-1" />
                  <TerminalBrand fallbackOutlet={terminal} surfaceLabel="KOT" />
                </span>
              </header>
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
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
            </div>
          </SidebarInset>
        </SidebarProvider>
      </Suspense>
    </OutletRouteSync>
  );
}
