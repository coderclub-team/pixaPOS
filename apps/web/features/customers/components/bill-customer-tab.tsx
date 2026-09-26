"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Label } from "@pixa/ui/base-ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { getCustomerById, updateCustomer } from "../api/service";
import { setCustomerNotes } from "@/features/orders/api/service";
import { customerKeys } from "../api/queries";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { Input } from "@pixa/ui/base-ui/input";
import CustomerLinkBlock from "./customer-link-block";
import AddressMap from "./address-map";
import { toast } from "sonner";
import * as z from "zod";

const billCustomerSchema = z.object({
  name: z.string().min(1, "Name required"),
  phone: z.string().min(1, "Phone required"),
  email: z.string(),
  notes: z.string(),
  address: z.object({
    label: z.enum(["home", "work", "other"]),
    line1: z.string(),
    line2: z.string(),
    locality: z.string(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    country: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
});

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
        <OrderNotesBlock orderId={orderId} />
        <CustomerLinkBlock orderId={orderId} />
        <p className="text-xs text-muted-foreground">
          Link or create a customer to edit details, address, and map pin.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <OrderNotesBlock orderId={orderId} />
      <CustomerEditor key={customer.id} customerId={customer.id} orderId={orderId} />
    </div>
  );
}

/**
 * Order-level notes (allergies, accessibility, requests) — distinct from the
 * customer record. Editable until the order completes; printed on every KOT
 * so late allergy flags still reach the kitchen.
 */
function OrderNotesBlock({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const [draft, setDraft] = useState<string | null>(null);
  const locked = order?.status === "COMPLETED" || order?.status === "CANCELLED";
  const value = draft ?? order?.customer_notes ?? "";

  const mutation = useMutation({
    mutationFn: (notes: string) => setCustomerNotes(orderId, notes),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      getQueryClient().invalidateQueries({ queryKey: orderKeys.all });
      setDraft(null);
      toast.success("Order notes saved");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't save notes"),
  });

  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <Label htmlFor={`order-notes-${orderId}`} className="text-xs text-muted-foreground">
          Allergy / order notes
        </Label>
        <Input
          id={`order-notes-${orderId}`}
          value={value}
          disabled={locked || mutation.isPending}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nut allergy, no spicy…"
          autoComplete="off"
        />
        {draft !== null && draft !== (order?.customer_notes ?? "") && (
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={mutation.isPending || locked}
              onClick={() => mutation.mutate(value)}
            >
              {mutation.isPending ? "Saving…" : "Save notes"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
    } as any,
    validators: {
      onSubmit: billCustomerSchema,
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
      <Input
        id={`cust-${k}`}
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
