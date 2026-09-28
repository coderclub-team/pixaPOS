"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import CustomerForm from "./customer-form";
import { customerQueryOptions } from "../api/queries";
import { ordersQueryOptions } from "@/features/orders/api/queries";
import {
  rewardBalanceQueryOptions,
  rewardLedgerQueryOptions,
} from "@/features/rewards/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { formatINR } from "@/lib/money";

type CustomerViewPageProps = {
  customerId: string;
};

export default function CustomerViewPage({ customerId }: CustomerViewPageProps) {
  if (customerId === "new") {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <CustomerForm initialData={null} pageTitle="Create New Customer" />
      </div>
    );
  }

  return <EditCustomerView customerId={customerId} />;
}

function EditCustomerView({ customerId }: { customerId: string }) {
  const { data } = useSuspenseQuery(customerQueryOptions(customerId));

  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <CustomerForm initialData={data} pageTitle="Edit Customer" />
      <RewardCard customerId={customerId} />
      <CustomerOrderHistory customerId={customerId} />
    </div>
  );
}

function RewardCard({ customerId }: { customerId: string }) {
  const { data: balance } = useSuspenseQuery(rewardBalanceQueryOptions(customerId));
  const { data: ledger } = useSuspenseQuery(rewardLedgerQueryOptions(customerId));
  if ((balance ?? 0) <= 0 && (ledger ?? []).length === 0) return null;
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-left text-lg font-bold">
          Rewards
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
            {balance ?? 0} pts · ₹{balance ?? 0}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Earn 1 pt per ₹10 on completed bills · 1 pt = ₹1 on any bill.
        </p>
        {(ledger ?? []).slice(0, 8).map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm"
          >
            <span className="capitalize text-muted-foreground">
              {e.reason}
              {e.note ? ` · ${e.note}` : ""}
              <span className="ml-2 text-xs">{new Date(e.created_at).toLocaleDateString()}</span>
            </span>
            <span className={e.delta_points >= 0 ? "text-green-600" : "text-destructive"}>
              {e.delta_points >= 0 ? "+" : ""}
              {e.delta_points}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CustomerOrderHistory({ customerId }: { customerId: string }) {
  const { data: orders } = useSuspenseQuery(ordersQueryOptions({ customer_id: customerId }));

  if (!orders.length) return null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-left text-lg font-bold">
          Order history ({orders.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/dashboard/orders/${o.id}`}
            className="flex items-center justify-between rounded-lg border p-2 text-sm transition-colors hover:border-primary"
          >
            <span>
              <span className="font-medium">{o.order_number}</span>
              <span className="ml-2 text-xs capitalize text-muted-foreground">
                {o.channel.replace("_", " ")} · {o.status.toLowerCase().replace("_", " ")} ·{" "}
                {new Date(o.created_at).toLocaleDateString()}
              </span>
            </span>
            <span className="font-medium">{formatINR(o.total_paise)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
