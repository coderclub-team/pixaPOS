"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { customerSchema } from "../schemas/customer";
import { getCustomerById, updateCustomer } from "../api/service";
import { customerKeys } from "../api/queries";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { getQueryClient } from "@/lib/query-client";
import CustomerLinkBlock from "./customer-link-block";
import AddressMap from "./address-map";
import { toast } from "sonner";

/**
 * Bill-panel Customer tab: link/create block, then full editor (contact +
 * primary address + bidirectional map) for the linked customer.
 */
export default function BillCustomerTab({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: customer } = useQuery({
    queryKey: customerKeys.detail(order?.customer_id ?? ""),
    queryFn: () => getCustomerById(order?.customer_id ?? ""),
    enabled: !!order?.customer_id,
  });

  if (!order?.customer_id || !customer) {
    return (
      <div className="space-y-2">
        <CustomerLinkBlock orderId={orderId} />
        <p className="text-xs text-muted-foreground">
          Link or create a customer to edit details, address, and map pin.
        </p>
      </div>
    );
  }
  return <CustomerEditor key={customer.id} customerId={customer.id} orderId={orderId} />;
}

function CustomerEditor({ customerId, orderId }: { customerId: string; orderId: string }) {
  const { data: customer } = useQuery({
    queryKey: customerKeys.detail(customerId),
    queryFn: () => getCustomerById(customerId),
  });

  const mutation = useMutation({
    mutationFn: (values: {
      name: string;
      phone: string;
      email: string;
      notes: string;
      address: Record<string, unknown>;
    }) =>
      updateCustomer(customerId, {
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        notes: values.notes || undefined,
        addresses: [values.address as never],
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: customerKeys.detail(customerId) });
      getQueryClient().invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success("Customer updated");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't update customer"),
  });

  const primary = customer?.addresses?.find((a) => a.is_primary) ?? customer?.addresses?.[0];

  const form = useAppForm({
    defaultValues: {
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      notes: customer?.notes ?? "",
      address: {
        label: primary?.label ?? "home",
        line1: primary?.line1 ?? "",
        line2: primary?.line2 ?? "",
        locality: primary?.locality ?? "",
        city: primary?.city ?? "",
        state: primary?.state ?? "",
        postal_code: primary?.postal_code ?? "",
        country: primary?.country ?? "IN",
        latitude: primary?.latitude,
        longitude: primary?.longitude,
      },
    },
    validators: {
      onSubmit: customerSchema.pick({ name: true, phone: true, email: true, notes: true }),
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  if (!customer) {
    return <p className="text-xs text-muted-foreground">Loading customer…</p>;
  }

  return (
    <div className="space-y-4">
      <CustomerLinkBlock orderId={orderId} />
      <Card>
        <CardHeader>
          <CardTitle className="text-left text-base font-bold">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.AppField
                  name="name"
                  children={(field) => <field.TextField label="Name" required />}
                />
                <form.AppField
                  name="phone"
                  children={(field) => <field.TextField label="Phone" required />}
                />
              </div>
              <form.AppField
                name="email"
                children={(field) => <field.TextField label="Email" placeholder="Optional" />}
              />
              <form.AppField
                name="notes"
                children={(field) => (
                  <field.TextareaField
                    label="Notes"
                    placeholder="Preferences, allergies…"
                    rows={2}
                  />
                )}
              />
            </FieldGroup>
            <form.AppField
              name="address"
              children={(field) => (
                <AddressEditor
                  value={field.state.value as never}
                  onChange={(patch) =>
                    field.setValue({ ...(field.state.value as object), ...patch })
                  }
                />
              )}
            />
            <div className="flex justify-end gap-2">
              <form.AppForm children={<form.SubmitButton>Save customer</form.SubmitButton>} />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AddressEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const v = value as Record<string, string | number | undefined>;
  const text = (k: string, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground" htmlFor={`cust-${k}`}>
        {label}
      </label>
      <input
        id={`cust-${k}`}
        className="h-9 w-full rounded-lg border px-2 text-sm"
        value={(v[k] as string) ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange({ [k]: e.target.value })}
      />
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Primary address</p>
      <div className="grid grid-cols-1 gap-3">
        {text("line1", "Address line 1", "Flat, street…")}
        {text("line2", "Address line 2 (optional)")}
        <div className="grid grid-cols-2 gap-3">
          {text("locality", "Locality")}
          {text("city", "City")}
          {text("state", "State")}
          {text("postal_code", "Pincode")}
        </div>
      </div>
      <AddressMap
        value={{
          line1: (v.line1 as string) ?? "",
          line2: (v.line2 as string) ?? "",
          locality: (v.locality as string) ?? "",
          city: (v.city as string) ?? "",
          state: (v.state as string) ?? "",
          postal_code: (v.postal_code as string) ?? "",
          country: "IN",
          latitude: v.latitude as number | undefined,
          longitude: v.longitude as number | undefined,
        }}
        onChange={onChange}
      />
    </div>
  );
}
