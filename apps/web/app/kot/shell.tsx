"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger } from "@pixa/ui/base-ui/sidebar";
import { ThemeModeToggle } from "@/components/themes/theme-mode-toggle";
import { getQueryClient } from "@/lib/query-client";
import { tableKeys } from "@/features/table/api/queries";
import { orderKeys } from "@/features/orders/api/queries";
import { floorKeys } from "@/features/floor/api/queries";
import OrderTerminalPage from "@/features/table/components/order-terminal-view";
import CategorySidebar from "@/features/orders/components/category-sidebar";
import { CategorySelectionProvider } from "@/features/orders/components/category-selection";

/**
 * Standalone KOT counter: dashboard shell pattern (app sidebar with brand,
 * categories and profile footer + inset header/content). The sidebar is
 * always visible; before any table is tapped it shows a placeholder matching
 * the bill panel. Mount on a counter tablet, sign in once.
 */
export default function KotShell() {
  return (
    <SidebarProvider defaultOpen>
      <CategorySelectionProvider>
        <Sidebar collapsible="icon">
          <CategorySidebar />
        </Sidebar>
        <SidebarInset>
          <KotShellMain />
        </SidebarInset>
      </CategorySelectionProvider>
    </SidebarProvider>
  );
}

function KotShellMain() {
  const refresh = () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: tableKeys.all });
    qc.invalidateQueries({ queryKey: orderKeys.all });
    qc.invalidateQueries({ queryKey: floorKeys.all });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
        <span className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <span className="leading-tight">
            <span className="block text-sm font-bold">Counter terminal</span>
            <span className="block text-[11px] text-muted-foreground">
              Fire tickets, bill and collect
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <ThemeModeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            title="Refresh floor, tables and orders"
          >
            <Icons.refresh className="mr-1 size-4" /> Refresh
          </Button>
        </span>
      </header>
      <main className="flex-1 overflow-y-auto p-3">
        <OrderTerminalPage hideDescription hideTitle />
      </main>
    </div>
  );
}
