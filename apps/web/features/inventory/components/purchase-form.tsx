"use client";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Textarea } from "@pixa/ui/base-ui/textarea";
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createPurchase, updatePurchase } from "../api/service";
import {
  inventoryKeys,
  rawMaterialsQueryOptions,
  suppliersQueryOptions,
  purchaseOrdersQueryOptions,
} from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { Purchase } from "../api/types";
import { Icons } from "@pixa/ui/icons";
import * as z from "zod";

const formSchema = z.object({
  supplier_id: z.string().min(1, "Supplier required"),
  po_id: z.string().optional().or(z.literal("")),
  bill_date: z.string().min(1, "Bill date required"),
  due_date: z.string().optional().or(z.literal("")),
  paid_amount: z.number().min(0).optional(),
  payment_mode: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type FormItem = { material_id: string; qty: number; unit_cost: number; tax_percent: number };

export default function PurchaseForm({
  pageTitle,
  initialData,
}: {
  pageTitle: string;
  initialData?: Purchase | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = !!initialData && initialData.payment_status !== "paid";
  const { data: suppliers } = useQuery(suppliersQueryOptions());
  const { data: materials } = useQuery(rawMaterialsQueryOptions());
  const { data: pos } = useQuery(purchaseOrdersQueryOptions());

  const supplierOptions = (suppliers ?? []).map((s) => ({ label: s.name, value: s.id }));
  const materialOptions = (materials ?? []).map((m) => ({
    label: `${m.name} (${m.sku}) — ₹${m.cost_price}/${m.unit} GST ${m.tax_percent ?? 5}%`,
    value: m.id,
  }));
  const poOptions = (pos ?? []).map((p) => ({
    label: `${p.po_number} — ${p.supplier_name} (${p.status})`,
    value: p.id,
  }));

  const [items, setItems] = useState<FormItem[]>(
    initialData?.items?.map((it) => ({
      material_id: it.material_id,
      qty: it.qty,
      unit_cost: it.unit_cost,
      tax_percent: it.tax_percent ?? 5,
    })) ?? [{ material_id: "", qty: 10, unit_cost: 0, tax_percent: 5 }],
  );
  const [itemsError, setItemsError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + it.qty * it.unit_cost, 0);
    const tax = items.reduce(
      (s, it) => s + it.qty * it.unit_cost * ((it.tax_percent ?? 0) / 100),
      0,
    );
    const total = subtotal + tax;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [items]);

  const createMutation = useMutation({
    mutationFn: (v: any) => createPurchase({ ...v, items }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase recorded — stock added and bill created");
      router.push("/dashboard/inventory/purchases");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: (v: any) => updatePurchase(initialData!.id, { ...v, items }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase updated");
      router.push("/dashboard/inventory/purchases");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const prefillPoId = !initialData ? (searchParams.get("poId") ?? "") : "";
  const form = useAppForm({
    defaultValues: {
      supplier_id: initialData?.supplier_id ?? "",
      po_id: initialData?.po_id ?? prefillPoId,
      bill_date: initialData?.bill_date ?? new Date().toISOString().slice(0, 10),
      due_date:
        initialData?.due_date ??
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      paid_amount: initialData?.paid_amount ?? 0,
      payment_mode: initialData?.payment_mode ?? "",
      notes: (initialData as any)?.notes ?? "",
    } as any,
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      if (items.length === 0) {
        setItemsError("Add at least one material");
        return;
      }
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.material_id) return setItemsError(`Row ${i + 1}: select material`);
        if (!it.qty || it.qty < 1) return setItemsError(`Row ${i + 1}: qty ≥1`);
        if (it.unit_cost < 0) return setItemsError(`Row ${i + 1}: unit cost invalid`);
      }
      const ids = items.map((it) => it.material_id);
      if (new Set(ids).size !== ids.length) return setItemsError("Duplicate materials");
      if ((value.paid_amount ?? 0) > totals.total) return toast.error("Paid exceeds total");
      setItemsError(null);
      if (isEdit) await updateMutation.mutateAsync(value);
      else await createMutation.mutateAsync(value);
    },
  });

  const handlePoChange = (poId: string) => {
    form.setFieldValue("po_id" as any, poId);
    const po = (pos ?? []).find((p) => p.id === poId);
    if (po) {
      form.setFieldValue("supplier_id" as any, po.supplier_id);
      setItems(
        po.items.map((it) => ({
          material_id: it.material_id,
          qty: it.qty,
          unit_cost: it.unit_cost,
          tax_percent: materials?.find((m) => m.id === it.material_id)?.tax_percent ?? 5,
        })),
      );
      toast.success(`Linked to ${po.po_number} — items prefilled`);
    }
  };

  const updateItem = (idx: number, patch: Partial<FormItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setItemsError(null);
  };
  const addItem = () =>
    setItems((prev) => [...prev, { material_id: "", qty: 10, unit_cost: 0, tax_percent: 5 }]);
  const removeItem = (idx: number) => {
    if (items.length === 1) return toast.error("At least one item required");
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (
      prefillPoId &&
      pos &&
      pos.length > 0 &&
      !initialData &&
      items.length === 1 &&
      items[0].material_id === ""
    ) {
      const po = pos.find((p) => p.id === prefillPoId);
      if (po) {
        form.setFieldValue("supplier_id" as any, po.supplier_id);
        setItems(
          po.items.map((it) => ({
            material_id: it.material_id,
            qty: it.qty,
            unit_cost: it.unit_cost,
            tax_percent:
              (it as any).tax_percent ??
              materials?.find((m) => m.id === it.material_id)?.tax_percent ??
              5,
          })),
        );
      }
    }
  }, [prefillPoId, pos, materials]);

  return (
    <Card className="mx-auto w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
        <CardDescription>
          Purchase Bill — direct or linked to PO. Stock adds on save. Due date defaults +15 days.
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
              name="supplier_id"
              children={(field) => (
                <field.SelectField
                  label="Supplier *"
                  required
                  options={supplierOptions}
                  placeholder="Select supplier"
                />
              )}
            />
            <div className="space-y-1">
              <Label className="text-sm font-medium">Link Purchase Order (optional)</Label>
              <Select
                value={(form.getFieldValue("po_id" as any) as string) ?? ""}
                onValueChange={handlePoChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Direct purchase (no PO) or select PO" />
                </SelectTrigger>
                <SelectContent>
                  {poOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If selected, supplier & items prefill from PO.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Materials *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Icons.add className="mr-1 h-4 w-4" /> Add Item
                </Button>
              </div>
              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[1fr_90px_110px_90px_40px]"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Material {idx + 1}</Label>
                      <Select
                        value={it.material_id}
                        onValueChange={(v) => updateItem(idx, { material_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Unit Cost</Label>
                      <Input
                        type="number"
                        min={0}
                        value={it.unit_cost}
                        onChange={(e) => updateItem(idx, { unit_cost: Number(e.target.value) })}
                      />
                      <div className="text-[11px] text-muted-foreground">
                        ₹{(it.qty * it.unit_cost).toFixed(0)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">GST %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={28}
                        value={it.tax_percent}
                        onChange={(e) => updateItem(idx, { tax_percent: Number(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                      >
                        <Icons.trash className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {itemsError && <p className="text-sm text-destructive">{itemsError}</p>}
              <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST</span>
                  <span>₹{totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>₹{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="bill_date"
                children={(field) => <field.TextField label="Bill Date *" type="date" required />}
              />
              <form.AppField
                name="due_date"
                children={(field) => (
                  <field.TextField label="Due Date" type="date" description="+15 days default" />
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="paid_amount"
                children={(field) => (
                  <field.TextField
                    label="Paid Amount"
                    type="number"
                    placeholder="0"
                    description={`Balance ₹${(totals.total - Number(form.getFieldValue("paid_amount" as any) ?? 0)).toFixed(2)}`}
                  />
                )}
              />
              <form.AppField
                name="payment_mode"
                children={(field) => (
                  <field.SelectField
                    label="Payment Mode"
                    options={[
                      { label: "Cash", value: "cash" },
                      { label: "UPI", value: "upi" },
                      { label: "Bank", value: "bank" },
                      { label: "Credit (unpaid)", value: "credit" },
                    ]}
                    placeholder="Select"
                  />
                )}
              />
            </div>
            <form.AppField
              name="notes"
              children={(field) => (
                <field.TextareaField label="Notes" placeholder="Invoice no / remarks" rows={2} />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm
              children={
                <form.SubmitButton>
                  {isEdit ? "Update Purchase" : "Create Purchase"}
                </form.SubmitButton>
              }
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
