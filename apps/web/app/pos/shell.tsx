"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@pixa/ui/base-ui/sidebar";
import { ThemeModeToggle } from "@/components/themes/theme-mode-toggle";
import { getQueryClient } from "@/lib/query-client";
import { useNow } from "@/lib/use-now";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { isChannelOpen } from "@/features/outlet/api/service";
import { tableKeys } from "@/features/table/api/queries";
import { orderKeys } from "@/features/orders/api/queries";
import { floorKeys } from "@/features/floor/api/queries";
import OrderTerminalPage from "@/features/table/components/order-terminal-view";
import AppSidebar from "@/components/layout/app-sidebar";
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
 * Standalone POS terminal: dashboard shell pattern (shared AppSidebar with
 * role-filtered nav + inset header/content). Order types (dine-in, counter,
 * takeaway, delivery) switch the workspace; category filtering lives in the
 * menu toolbar dialog. Mount on a counter tablet, sign in once.
 */
export default function PosShell() {
  return (
    <SidebarProvider defaultOpen={false}>
      <OrderTypeProvider>
        <CategorySelectionProvider>
          <AppSidebar />
          <SidebarInset>
            <PosShellMain />
          </SidebarInset>
        </CategorySelectionProvider>
      </OrderTypeProvider>
    </SidebarProvider>
  );
}

function OrderTypePicker() {
  const selection = useOrderType();
  const { data: outlet } = useQuery(outletQueryOptions);
  const now = useNow();
  if (!selection) return null;
  const closedFor = (value: string) => !!outlet && !isChannelOpen(outlet, value, new Date(now));
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
            {closedFor(o.value) ? " · Closed" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PosShellMain() {
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
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <OrderTerminalPage hideDescription hideTitle fillHeight />
      </main>
    </div>
  );
}
