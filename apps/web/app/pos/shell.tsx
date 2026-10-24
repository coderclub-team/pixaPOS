"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@pixa/ui/base-ui/sidebar";
import { ThemeModeToggle } from "@pixa/ui/themes/theme-mode-toggle";
import SyncStatus from "@/components/sync-status";
import { TerminalBrand } from "@/components/terminal-brand";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useServiceWorker } from "@/hooks/use-service-worker";
import { getQueryClient } from "@/lib/query-client";
import { RealtimeConnectionStatus } from "@/components/realtime-connection-status";
import { PixaSoundControl } from "@/components/pixa-sound-control";
import { usePixaNotifications } from "@/hooks/use-pixa-notifications";
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
import { Skeleton } from "@pixa/ui/base-ui/skeleton";
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
export default function PosShell({
  fallbackOutlet,
}: {
  fallbackOutlet?: { id: string; name: string; code: string; organizationId: string } | null;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <OrderTypeProvider>
        <CategorySelectionProvider>
          <AppSidebar />
          <SidebarInset>
            <PosShellMain fallbackOutlet={fallbackOutlet} />
          </SidebarInset>
        </CategorySelectionProvider>
      </OrderTypeProvider>
    </SidebarProvider>
  );
}

/**
 * Pending-state mirror of the POS terminal: header row, then the terminal
 * workspace — left product-grid region (toolbar + category row + card grid)
 * and right bill/keypad panel (header + line rows + totals + action footer).
 * Same proportions as OrderTerminalPage + bill panel so CLS stays 0.
 */
export function PosShellSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading POS terminal"
      className="flex h-dvh animate-pulse flex-col overflow-hidden bg-background"
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="grid gap-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:gap-4">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="hidden w-96 shrink-0 flex-col gap-2 rounded-xl border p-3 lg:flex">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-3/4 rounded-md" />
          </div>
          <div className="mt-auto grid gap-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
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

function PosShellMain({
  fallbackOutlet,
}: {
  fallbackOutlet?: { id: string; name: string; code: string; organizationId: string } | null;
}) {
  const refresh = () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: tableKeys.all });
    qc.invalidateQueries({ queryKey: orderKeys.all });
    qc.invalidateQueries({ queryKey: floorKeys.all });
  };
  const { installEvt, installed, promptInstall } = useInstallPrompt();
  useServiceWorker();
  const { state: rtState, lastSequence } = usePixaNotifications("POS");

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
        <span className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <TerminalBrand fallbackOutlet={fallbackOutlet} surfaceLabel="Counter" />
        </span>
        <span className="flex items-center gap-1.5">
          <OrderTypePicker />
          <RealtimeConnectionStatus state={rtState} lastSequence={lastSequence} />
          <PixaSoundControl terminal="POS" />
          <SyncStatus />
          <ThemeModeToggle />
          {!installed && installEvt && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={promptInstall}
              title="Install POS app"
              aria-label="Install POS app"
            >
              <Icons.download className="size-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            title="Refresh floor, tables and orders"
            aria-label="Refresh floor, tables and orders"
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
