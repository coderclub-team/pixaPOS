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
import {
  OrderTypeProvider,
  kotOrderTypeOptions,
  useOrderType,
  type KotOrderType,
} from "@/features/orders/components/order-type";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";

/**
 * Standalone KOT counter: dashboard shell pattern (app sidebar with brand,
 * categories and profile footer + inset header/content). The sidebar starts
 * collapsed, is always visible, and shows a placeholder matching the bill
 * panel until a table is tapped. Mount on a counter tablet, sign in once.
 */
export default function KotShell() {
  return (
    <SidebarProvider defaultOpen={false}>
      <OrderTypeProvider>
        <CategorySelectionProvider>
          <Sidebar collapsible="icon">
            <CategorySidebar />
          </Sidebar>
          <SidebarInset>
            <KotShellMain />
          </SidebarInset>
        </CategorySelectionProvider>
      </OrderTypeProvider>
    </SidebarProvider>
  );
}

function OrderTypePicker() {
  const selection = useOrderType();
  if (!selection) return null;
  return (
    <Select
      value={selection.orderType}
      onValueChange={(v) => selection.setOrderType(v as KotOrderType)}
    >
      <SelectTrigger aria-label="Order type" className="h-8 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {kotOrderTypeOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
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
          <OrderTypePicker />
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
      <main className="min-h-0 flex-1 overflow-hidden p-3">
        <OrderTerminalPage hideDescription hideTitle fillHeight />
      </main>
    </div>
  );
}
