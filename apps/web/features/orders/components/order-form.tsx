"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { createOrderSchema, orderChannelOptions, type CreateOrderValues } from "../schemas/order";
import type { OrderWithDerived } from "../api/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createOrder } from "../api/service";
import { orderKeys } from "../api/queries";
import { tablesQueryOptions } from "@/features/table/api/queries";
import { getQueryClient } from "@/lib/query-client";

export default function OrderForm({
  pageTitle,
  onCreated,
}: {
  pageTitle: string;
  /**
   * When provided (the /new two-phase flow), the created DRAFT order is
   * handed back instead of navigating — the caller renders the workspace
   * inline so /new becomes identical to the detail page.
   */
  onCreated?: (order: OrderWithDerived) => void;
}) {
  const router = useRouter();
  const { data: tables } = useQuery(tablesQueryOptions());

  const createMutation = useMutation({
    mutationFn: (values: CreateOrderValues) =>
      createOrder({
        channel: values.channel,
        table_id: values.channel === "dine_in" ? values.table_id || undefined : undefined,
        occupancy_group_id: values.occupancy_group_id || undefined,
        customer_name: values.customer_name?.trim() || undefined,
        customer_phone: values.customer_phone?.trim() || undefined,
        external_ref: values.external_ref?.trim() || undefined,
        initial_status: "DRAFT",
      }),
    onSuccess: (order) => {
      getQueryClient().invalidateQueries({ queryKey: orderKeys.all });
      if (onCreated) {
        onCreated(order);
        return;
      }
      toast.success(`Order ${order.order_number} created`);
      // Replace (not push): the form URL never stays in history, so Back
      // lands on the orders list and the stale form can't be resubmitted
      // into a duplicate order (PRG pattern).
      router.replace(`/dashboard/orders/${order.id}`);
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't create order. Try again."),
  });

  const form = useAppForm({
    defaultValues: {
      channel: "dine_in",
      table_id: "",
      occupancy_group_id: "",
      customer_name: "",
      customer_phone: "",
      external_ref: "",
    } as unknown as CreateOrderValues,
    validators: { onSubmit: createOrderSchema },
    onSubmit: async ({ value }) => {
      if (value.channel === "dine_in" && !value.table_id) {
        toast.error("Dine-in orders require a table");
        return;
      }
      if (
        value.channel !== "dine_in" &&
        !value.customer_name?.trim() &&
        !value.customer_phone?.trim()
      ) {
        toast.error("Takeaway, delivery and online orders require a customer name or phone");
        return;
      }
      await createMutation.mutateAsync(value);
    },
  });

  const tableOptions = (tables ?? [])
    .filter((t) => t.is_active !== false)
    .map((t) => ({
      value: t.id,
      label: `Table ${t.number} · ${t.capacity} seats${t.status !== "available" ? ` (${t.status})` : ""}`,
    }));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
        <CardDescription>
          Starts an order cart — add items next; the first fire sends it to the kitchen.
        </CardDescription>
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
            <form.AppField
              name="channel"
              children={(field) => (
                <field.SelectField
                  label="Channel"
                  required
                  options={orderChannelOptions.map((o) => ({ value: o.value, label: o.label }))}
                />
              )}
            />
            <form.Subscribe
              selector={(s) => s.values.channel}
              children={(channel) =>
                channel === "dine_in" ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <form.AppField
                      name="table_id"
                      children={(field) => (
                        <field.SelectField
                          label="Table"
                          required
                          placeholder="Select table"
                          options={tableOptions}
                          description="Dine-in orders require a table"
                        />
                      )}
                    />
                    <form.AppField
                      name="external_ref"
                      children={(field) => (
                        <field.TextField label="Aggregator ref" placeholder="Optional" />
                      )}
                    />
                  </div>
                ) : (
                  <>
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
                          <field.TextField label="Customer phone" placeholder="10-digit mobile" />
                        )}
                      />
                    </div>
                    <form.AppField
                      name="external_ref"
                      children={(field) => (
                        <field.TextField
                          label="Aggregator ref"
                          placeholder="Zomato / Swiggy order id"
                          description="Required by aggregator reconciliation"
                        />
                      )}
                    />
                  </>
                )
              }
            />
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/orders")}
            >
              Cancel
            </Button>
            <form.AppForm children={<form.SubmitButton>Create Order</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
