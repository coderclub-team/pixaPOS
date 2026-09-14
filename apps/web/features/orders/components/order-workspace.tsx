"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Icons } from "@pixa/ui/icons";
import { formatINR } from "@/lib/money";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { kitchenKeys } from "@/features/kitchen/api/queries";
import { paymentKeys } from "@/features/payments/api/queries";
import { eventKeys } from "@/features/events/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { useCrossTabSync } from "@/lib/use-cross-tab-sync";
import { tableQueryOptions } from "@/features/table/api/queries";
import CustomerLinkBlock from "@/features/customers/components/customer-link-block";
import SeatingSection from "@/features/table/components/seating-section";
import OrderBillPanel, { CancelOrderBlock } from "./bill-panel";
import SplitBillCard from "./split-bill-card";
import PaymentsCard from "./payments-card";
import { OrderStatusPill } from "./order-kitchen-progress";
import OrderTimeline from "./order-timeline";
import KotItemDialog from "./kot-item-dialog";

export default function OrderWorkspacePage({ orderId }: { orderId: string }) {
  useCrossTabSync();
  const { data: order, isPending, dataUpdatedAt } = useQuery(orderQueryOptions(orderId));
  const [addOpen, setAddOpen] = useState(false);
  const [activePartition, setActivePartition] = useState<string | null>(null);

  if (isPending) {
    return (
      <PageContainer pageTitle="Order" isLoading>
        <div />
      </PageContainer>
    );
  }

  if (!order) {
    return (
      <PageContainer pageTitle="Order not found">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            This order does not exist.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const terminal = order.status === "COMPLETED" || order.status === "CANCELLED";

  return (
    <PageContainer
      pageTitle={order.status === "DRAFT" ? "New order" : `Order ${order.order_number}`}
      pageDescription={`${order.channel.replace("_", " ")} · ${(order.status === "DRAFT" ? "New order" : order.status.toLowerCase().replace("_", " "))} · ${formatINR(order.grand_total_paise)}`}
      pageHeaderAction={
        <div className="flex items-center gap-1.5">
          {dataUpdatedAt > 0 && (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            title="Refresh order, kitchen tickets and payments"
            onClick={() => {
              getQueryClient().invalidateQueries({ queryKey: orderKeys.detail(order.id) });
              getQueryClient().invalidateQueries({ queryKey: kitchenKeys.byOrder(order.id) });
              getQueryClient().invalidateQueries({ queryKey: paymentKeys.byOrder(order.id) });
              getQueryClient().invalidateQueries({ queryKey: paymentKeys.refundsByOrder(order.id) });
              getQueryClient().invalidateQueries({ queryKey: eventKeys.byOrder(order.id) });
            }}
          >
            <Icons.refresh className="size-4" />
          </Button>
          <Button
            className="text-xs md:text-sm"
            onClick={() => setAddOpen(true)}
            disabled={terminal}
            title={terminal ? `Order is ${order.status.toLowerCase()}` : "Add items — each creates a new KOT"}
          >
            <Icons.add className="mr-2 h-4 w-4" /> Add Items
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <OrderDetailsCard orderId={order.id} />
        <OrderBillPanel
          orderId={order.id}
          title="Bill"
          showSplit={false}
          showTender={false}
          showPayments={false}
          showCancel={false}
        />
        <SplitBillCard
          orderId={order.id}
          activePartition={activePartition}
          onSelectPartition={setActivePartition}
        />
        <PaymentsCard orderId={order.id} activePartition={activePartition} />
        <OrderTimeline orderId={order.id} />
        {!terminal && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Danger zone</CardTitle>
            </CardHeader>
            <CardContent>
              <CancelOrderBlock orderId={order.id} />
            </CardContent>
          </Card>
        )}
      </div>

      <KotItemDialog orderId={order.id} open={addOpen} onOpenChange={setAddOpen} />
    </PageContainer>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

/** Compact identity strip: order facts + customer + seating. Money lives below. */
function OrderDetailsCard({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: table } = useQuery({
    ...tableQueryOptions(order?.table_id ?? ""),
    enabled: !!order?.table_id,
  });
  if (!order) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Order Details</span>
          <OrderStatusPill order={order} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="divide-y">
          <InfoRow label="Order no.">
            <span className="font-medium">{order.order_number}</span>
          </InfoRow>
          <InfoRow label="Channel">
            <span className="capitalize">{order.channel.replace("_", " ")}</span>
          </InfoRow>
          {order.table_number_snapshot && (
            <InfoRow label="Table">
              <span>Table {order.table_number_snapshot}</span>
            </InfoRow>
          )}
          {order.external_ref && (
            <InfoRow label="Aggregator ref">
              <span className="font-mono text-xs">{order.external_ref}</span>
            </InfoRow>
          )}
          <InfoRow label="Placed">
            <span className="text-muted-foreground">
              {new Date(order.created_at).toLocaleString()}
            </span>
          </InfoRow>
          <InfoRow label="Items">
            <span>
              {order.items.length} item{order.items.length === 1 ? "" : "s"} · {order.kot_count}{" "}
              KOT{order.kot_count === 1 ? "" : "s"}
            </span>
          </InfoRow>
        </div>
        <CustomerLinkBlock orderId={order.id} />
        {table && <SeatingSection table={table} floorId={table.floor_id} />}
      </CardContent>
    </Card>
  );
}
