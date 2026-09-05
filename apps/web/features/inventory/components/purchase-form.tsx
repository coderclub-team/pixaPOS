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
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createPurchase, updatePurchase } from "../api/service";
import {
  inventoryKeys,
  purchasesQueryOptions,
  rawMaterialsQueryOptions,
  suppliersQueryOptions,
  purchaseOrdersQueryOptions,
} from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { Purchase } from "../api/types";
import { Icons } from "@pixa/ui/icons";

type FormItem = {
  material_id: string;
  qty: number | string;
  unit_cost: number | string;
  tax_percent?: number;
};

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

  const supplierOptions = (suppliers ?? []).map((s) => ({
    label: `${s.name} — ${s.gstin ?? s.phone}`,
    value: s.id,
  }));
  const materialOptions = (materials ?? []).map((m) => ({
    label: `${m.name} (${m.sku}) — ₹${m.cost_price}/${m.unit}${m.tax_percent != null ? ` GST ${m.tax_percent}%` : ""}`,
    value: m.id,
  }));
  const prefillPoId = !initialData ? (searchParams.get("poId") ?? "") : "";
  // Odoo/Zoho standard: only sent POs that are not already billed are selectable (draft/received/cancelled hidden, invoiced hidden)
  const { data: allPurchases } = useQuery(purchasesQueryOptions());
  const billedPoIds = new Set(
    (allPurchases ?? []).map((pp: any) => pp.po_id).filter(Boolean) as string[],
  );
  // also include current edit's own po_id as allowed
  const currentPoId = (initialData as any)?.po_id ?? prefillPoId ?? "";
  const poOptions = (pos ?? [])
    .filter((p) => p.status === "sent")
    .filter((p) => !billedPoIds.has(p.id) || p.id === currentPoId)
    .map((p) => ({
      label: `${p.po_number} — ${p.supplier_name} (${p.status})`,
      value: p.id,
    }));

  const [items, setItems] = useState<FormItem[]>(
    initialData?.items?.map((it) => ({
      material_id: it.material_id,
      qty: it.qty,
      unit_cost: it.unit_cost,
      tax_percent: it.tax_percent,
    })) ?? [{ material_id: "", qty: 1, unit_cost: 0, tax_percent: undefined }],
  );
  const [itemsError, setItemsError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_cost) || 0),
      0,
    );
    const tax = items.reduce(
      (s, it) =>
        s + (Number(it.qty) || 0) * (Number(it.unit_cost) || 0) * ((it.tax_percent ?? 0) / 100),
      0,
    );
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
  }, [items]);

  const createMutation = useMutation({
    mutationFn: (v: any) => {
      const cleanItems = items.map((it) => ({
        ...it,
        qty: Number(it.qty),
        unit_cost: Number(it.unit_cost),
      }));
      return createPurchase({ ...v, items: cleanItems });
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase recorded — stock added and bill created");
      router.push("/dashboard/inventory/purchases");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: (v: any) => {
      const cleanItems = items.map((it) => ({
        ...it,
        qty: Number(it.qty),
        unit_cost: Number(it.unit_cost),
      }));
      return updatePurchase(initialData!.id, { ...v, items: cleanItems });
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase updated");
      router.push("/dashboard/inventory/purchases");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: {
      supplier_id: initialData?.supplier_id ?? "",
      po_id: (initialData as any)?.po_id ?? prefillPoId,
      bill_date: initialData?.bill_date ?? new Date().toISOString().slice(0, 10),
      due_date:
        initialData?.due_date ??
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      reference: (initialData as any)?.reference ?? "",
      paid_amount: initialData?.paid_amount ?? 0,
      payment_mode: (initialData as any)?.payment_mode ?? "",
      notes: (initialData as any)?.notes ?? "",
    } as any,
    validators: {
      onSubmit: ({ value }: any) => {
        if (!value.supplier_id) return { supplier_id: "Supplier required" } as any;
        if (!value.bill_date) return { bill_date: "Bill date required" } as any;
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      if (items.length === 0) return setItemsError("Add at least one material");
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.material_id) return setItemsError(`Row ${i + 1}: select material`);
        const q = Number(it.qty);
        if (it.qty === "" || Number.isNaN(q) || q < 1) return setItemsError(`Row ${i + 1}: qty ≥1`);
        const c = Number(it.unit_cost);
        if (it.unit_cost === "" || Number.isNaN(c) || c < 0)
          return setItemsError(`Row ${i + 1}: unit cost invalid`);
      }
      if ((value.paid_amount ?? 0) > totals.total) return toast.error("Paid exceeds total");
      setItemsError(null);
      if (isEdit) await updateMutation.mutateAsync(value);
      else await createMutation.mutateAsync(value);
    },
  });

  const handlePoChange = (poId: string) => {
    form.setFieldValue("po_id" as any, poId);
    if (!poId) return;
    const po = (pos ?? []).find((p) => p.id === poId);
    if (!po) return;
    if (po.status !== "sent") {
      toast.error("Only sent POs can be billed (Odoo: draft/received not selectable)");
      form.setFieldValue("po_id" as any, "");
      return;
    }
    if (billedPoIds.has(po.id) && po.id !== currentPoId) {
      toast.error("PO already billed — duplicate not allowed");
      form.setFieldValue("po_id" as any, "");
      return;
    }
    form.setFieldValue("supplier_id" as any, po.supplier_id);
    setItems(
      po.items.map((it) => ({
        material_id: it.material_id,
        qty: it.qty,
        unit_cost: it.unit_cost,
        tax_percent: materials?.find((m) => m.id === it.material_id)?.tax_percent,
      })),
    );
    toast.success(`Linked to ${po.po_number} — items prefilled`);
  };

  const updateItem = (idx: number, patch: Partial<FormItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setItemsError(null);
  };
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { material_id: "", qty: 1, unit_cost: 0, tax_percent: undefined },
    ]);
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
        if (po.status !== "sent") {
          toast.error("Linked PO must be sent (Odoo: draft/received not billable)");
          return;
        }
        if (billedPoIds.has(po.id)) {
          toast.error("PO already billed");
          return;
        }
        form.setFieldValue("supplier_id" as any, po.supplier_id);
        setItems(
          po.items.map((it) => ({
            material_id: it.material_id,
            qty: it.qty,
            unit_cost: it.unit_cost,
            tax_percent:
              (it as any).tax_percent ??
              materials?.find((m) => m.id === it.material_id)?.tax_percent,
          })),
        );
      }
    }
  }, [prefillPoId, pos, materials]);

  const supplierPreview = (() => {
    const sid = (form.getFieldValue("supplier_id" as any) as string) ?? initialData?.supplier_id;
    const s = suppliers?.find((x) => x.id === sid);
    if (!s) return null;
    return `${s.gstin ? `GSTIN ${s.gstin} • ` : ""}${s.phone} • ${s.email ?? ""}`;
  })();

  const handleShare = async () => {
    if (!initialData) return;
    const itemsText = initialData.items
      .map(
        (it) =>
          `• ${it.material_name ?? it.material_id} ${it.qty} @₹${it.unit_cost} GST${it.tax_percent ?? "-"}%`,
      )
      .join("\n");
    const text = `Purchase ${initialData.purchase_number} from PixaPOS\nSupplier: ${initialData.supplier_name} (${initialData.supplier_id})\nBill: ${new Date(initialData.bill_date).toLocaleDateString()} Due: ${initialData.due_date ? new Date(initialData.due_date).toLocaleDateString() : "-"} PO: ${initialData.po_number ?? "-"}\n\nItems:\n${itemsText}\nSubtotal: ₹${initialData.subtotal} GST: ₹${initialData.tax_amount} Total: ₹${initialData.total_amount} Paid: ₹${initialData.paid_amount}\nNotes: ${initialData.notes ?? "-"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Purchase ${initialData.purchase_number}`, text });
        toast.success("Purchase shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Purchase copied");
      } else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } catch {}
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        {/* Card 1 - Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
            <CardDescription>
              Purchase Bill — direct or linked to PO. Stock adds on save. Auto number PUR-YYYY-NNN.
              Due +15 days.
            </CardDescription>
            {initialData && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Purchase{" "}
                  <span className="font-mono font-medium">{initialData.purchase_number}</span> •{" "}
                  <span className="capitalize">{initialData.payment_status}</span>
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={handleShare}>
                  <Icons.share className="mr-1 h-4 w-4" /> Share
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="supplier_id"
                  children={(field) => (
                    <field.SelectField
                      label="Supplier *"
                      required
                      options={supplierOptions}
                      placeholder="Select supplier"
                      description={supplierPreview ?? "GSTIN & contact shown after selection"}
                    />
                  )}
                />
                <form.AppField
                  name="bill_date"
                  children={(field) => <field.TextField label="Bill Date *" type="date" required />}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="reference"
                  children={(field) => (
                    <field.TextField
                      label="Invoice # / Reference"
                      placeholder="Vendor invoice no"
                      description="Vendor bill number"
                    />
                  )}
                />
                <form.AppField
                  name="due_date"
                  children={(field) => (
                    <field.TextField label="Due Date" type="date" description="+15 days default" />
                  )}
                />
              </div>
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
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Card 2 - Materials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materials *</CardTitle>
            <CardDescription>
              Multi-item — rate defaults to last price, GST per material.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-end">
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Icons.add className="mr-1 h-4 w-4" /> Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => {
                const mat = materials?.find((m) => m.id === it.material_id);
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[1fr_90px_110px_80px_40px]"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Material {idx + 1}</Label>
                      <Select
                        value={it.material_id}
                        onValueChange={(v) =>
                          updateItem(idx, {
                            material_id: v,
                            tax_percent: materials?.find((m) => m.id === v)?.tax_percent,
                            unit_cost: materials?.find((m) => m.id === v)?.cost_price ?? 0,
                          } as any)
                        }
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
                      {mat && (
                        <div className="text-[11px] text-muted-foreground">
                          {mat.unit} • Stock {mat.stock_qty} • Avg ₹{mat.avg_cost}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={it.qty as any}
                        onChange={(e) =>
                          updateItem(idx, {
                            qty: e.target.value === "" ? ("" as any) : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Unit Cost</Label>
                      <Input
                        type="number"
                        min={0}
                        value={it.unit_cost as any}
                        onChange={(e) =>
                          updateItem(idx, {
                            unit_cost: e.target.value === "" ? ("" as any) : Number(e.target.value),
                          })
                        }
                      />
                      <div className="text-[11px] text-muted-foreground">
                        ₹{((Number(it.qty) || 0) * (Number(it.unit_cost) || 0)).toFixed(0)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">GST %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={28}
                        placeholder=""
                        value={it.tax_percent ?? ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            tax_percent: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
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
                );
              })}
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
          </CardContent>
        </Card>

        {/* Card 3 - Payment & Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldGroup>
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
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
