"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { createOrderSchema, orderChannelOptions } from "@/features/orders/schemas/order";
import { createOrder } from "@/features/orders/api/service";
import { orderKeys } from "@/features/orders/api/queries";
import { tablesQueryOptions } from "@/features/table/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import type { OrderChannel } from "@/features/orders/api/types";

export default function NewOrderPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<OrderChannel>("dine_in");
  const { data: tables } = useQuery(tablesQueryOptions({}));

  const createMut = useMutation({
    mutationFn: createOrder,
    onSuccess: (o) => {
      getQueryClient().invalidateQueries({ queryKey: orderKeys.all });
      toast.success(`Order ${o.order_number} started`);
      router.push(`/dashboard/orders/${o.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tableOptions = (tables ?? [])
    .filter((t) => !t.deleted_at && t.is_active && t.status !== "out_of_service")
    .map((t) => ({
      label: `Table ${t.number} (${t.seated_seats}/${t.capacity} seated)`,
      value: t.id,
    }));

  const form = useAppForm({
    defaultValues: {
      channel: "dine_in" as OrderChannel,
      table_id: "",
      occupancy_group_id: "",
      customer_name: "",
      customer_phone: "",
      external_ref: "",
    } as any,
    validators: { onSubmit: createOrderSchema },
    onSubmit: async ({ value }) => {
      await createMut.mutateAsync({
        ...value,
        table_id: value.table_id || undefined,
        customer_name: value.customer_name || undefined,
        customer_phone: value.customer_phone || undefined,
        external_ref: value.external_ref || undefined,
      });
    },
  });

  const isDineIn = channel === "dine_in";
  const isAggregator = channel === "zomato" || channel === "swiggy" || channel === "own_online";

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">New Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                Channel <span className="text-destructive">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {orderChannelOptions.map((c) => (
                  <Button
                    key={c.value}
                    type="button"
                    variant={channel === c.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setChannel(c.value as OrderChannel);
                      form.setFieldValue("channel", c.value as OrderChannel);
                    }}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Dine-in needs a table; all other channels need a customer.
              </p>
            </div>
            {isDineIn ? (
              <form.AppField
                name="table_id"
                children={(field) => (
                  <field.SelectField
                    label="Table"
                    required
                    options={tableOptions}
                    placeholder="Select table"
                    description="Order links to the table's occupancy group."
                  />
                )}
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="customer_name"
                  children={(field) => (
                    <field.TextField label="Customer name" placeholder="Guest name" />
                  )}
                />
                <form.AppField
                  name="customer_phone"
                  children={(field) => (
                    <field.TextField label="Customer phone" placeholder="Phone number" />
                  )}
                />
              </div>
            )}
            {isAggregator && (
              <form.AppField
                name="external_ref"
                children={(field) => (
                  <field.TextField
                    label="Aggregator order id"
                    placeholder="e.g. Zomato order id"
                    description="Manual punch-in reference for the aggregator order."
                  />
                )}
              />
            )}
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm
              children={
                <form.SubmitButton disabled={createMut.isPending}>
                  {createMut.isPending ? "Starting…" : "Start Order"}
                </form.SubmitButton>
              }
            />
          </div>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Prefer starting from the floor? Open{" "}
          <Link href="/dashboard/tables" className="underline">
            Tables
          </Link>{" "}
          and seat guests first.
        </p>
      </CardContent>
    </Card>
  );
}
