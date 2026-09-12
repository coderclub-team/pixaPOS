"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Icons } from "@pixa/ui/icons";
import { formatINR } from "@/lib/money";
import { orderQueryOptions } from "@/features/orders/api/queries";
import CustomerLinkBlock from "@/features/customers/components/customer-link-block";
import OrderBillPanel from "./bill-panel";
import OrderStatusText from "./order-status";
import KotItemDialog from "./kot-item-dialog";

export default function OrderWorkspacePage({ orderId }: { orderId: string }) {
  const { data: order, isPending } = useQuery(orderQueryOptions(orderId));
  const [addOpen, setAddOpen] = useState(false);

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
      pageTitle={`Order ${order.order_number}`}
      pageDescription={`${order.channel.replace("_", " ")} · ${order.status.toLowerCase().replace("_", " ")} · ${formatINR(order.grand_total_paise)}`}
      pageHeaderAction={
        <Button
          className="text-xs md:text-sm"
          onClick={() => setAddOpen(true)}
          disabled={terminal}
          title={terminal ? `Order is ${order.status.toLowerCase()}` : "Add items — each creates a new KOT"}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add Items
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <OrderInfoCard orderId={order.id} />
        <OrderBillPanel orderId={order.id} title="Bill" showCancel />
      </div>

      <KotItemDialog orderId={order.id} open={addOpen} onOpenChange={setAddOpen} />
    </PageContainer>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

function OrderInfoCard({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  if (!order) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Order details</span>
          <OrderStatusText status={order.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
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
        <div className="py-1">
          <CustomerLinkBlock orderId={order.id} />
        </div>
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
            {order.items.length} item{order.items.length === 1 ? "" : "s"} · {order.kot_count} KOT
            {order.kot_count === 1 ? "" : "s"}
          </span>
        </InfoRow>
      </CardContent>
    </Card>
  );
}


