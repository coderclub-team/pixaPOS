"use client";
import { useState, useMemo } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@pixa/ui/base-ui/field";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@pixa/ui/base-ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@pixa/ui/base-ui/command";
import { cn } from "@pixa/ui/lib/utils";
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPurchaseOrder, updatePurchaseOrder } from "../api/service";
import { inventoryKeys, rawMaterialsQueryOptions, suppliersQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { PurchaseOrder } from "../api/types";
import { Icons } from "@pixa/ui/icons";
import { purchaseOrderSchema } from "../schemas/purchase-order";

type POItem = {
  material_id: string;
  qty: number | string;
  unit_cost: number | string;
  tax_percent?: number;
  entry_unit?: string; // unit the row is entered in (purchase unit or base unit)
};

// 1 purchase_unit = rate base units; entry in purchase unit converts to base for stock/costing
const rawRate = (mat: any): number => Number(mat?.purchase_to_base_rate) || 0;
const hasPurchaseUom = (mat: any): boolean =>
  !!mat?.purchase_unit && mat.purchase_unit !== mat?.unit && rawRate(mat) > 0;
const rateFor = (mat: any): number => (hasPurchaseUom(mat) ? rawRate(mat) : 1);

export default function PurchaseOrderForm({
  pageTitle,
  initialData,
}: {
  pageTitle: string;
  initialData?: PurchaseOrder | null;
}) {
  const router = useRouter();
  const isEdit =
    !!initialData && initialData.status !== "received" && initialData.status !== "cancelled";
  const { data: suppliers } = useQuery(suppliersQueryOptions());
  const { data: materials } = useQuery(rawMaterialsQueryOptions());
  const supplierOptions = (suppliers ?? []).map((s) => ({
    label: `${s.name} — ${s.gstin ?? s.phone}`,
    value: s.id,
  }));
  const materialOptions = (materials ?? []).map((m) => ({
    label: `${m.name} (${m.sku}) — ₹${m.cost_price}/${m.unit}${m.tax_percent != null ? ` GST ${m.tax_percent}%` : ""}`,
    value: m.id,
  }));
  const selectedSupplier = suppliers?.find((s) => s.id === (initialData?.supplier_id ?? ""));

  const [items, setItems] = useState<POItem[]>(
    initialData?.items?.map((it) => {
      const pu = (it as any).purchase_unit;
      const inPurchase = !!pu && (it as any).purchase_qty !== undefined;
      return {
        material_id: it.material_id,
        qty: inPurchase ? ((it as any).purchase_qty as number) : it.qty,
        unit_cost: inPurchase ? ((it as any).purchase_unit_cost as number) : it.unit_cost,
        tax_percent: it.tax_percent,
        entry_unit: inPurchase ? pu : undefined,
      };
    }) ?? [{ material_id: "", qty: 1, unit_cost: 0, tax_percent: undefined }],
  );

  const toBaseItems = () =>
    items.map((it) => {
      const mat = materials?.find((m) => m.id === it.material_id);
      if (mat && hasPurchaseUom(mat) && (it.entry_unit ?? mat.purchase_unit) === mat.purchase_unit) {
        const rate = rateFor(mat);
        return {
          ...it,
          qty: Math.round((Number(it.qty) || 0) * rate * 1000) / 1000,
          unit_cost: Math.round(((Number(it.unit_cost) || 0) / rate) * 100) / 100,
          purchase_qty: Number(it.qty) || 0,
          purchase_unit: mat.purchase_unit,
          purchase_unit_cost: Number(it.unit_cost) || 0,
          entry_unit: undefined,
        };
      }
      const { entry_unit, ...rest } = it as any;
      return { ...rest, qty: Number(it.qty), unit_cost: Number(it.unit_cost) };
    });
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
    mutationFn: (v: any) => createPurchaseOrder({ ...v, items }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase order created as draft — not yet added to inventory");
      router.push("/dashboard/inventory/purchase-orders");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: (v: any) => updatePurchaseOrder(initialData!.id, { ...v, items }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase order updated");
      router.push("/dashboard/inventory/purchase-orders");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);

  const form = useAppForm({
    defaultValues: {
      supplier_id: initialData?.supplier_id ?? "",
      po_date: initialData?.po_date ?? today,
      reference: initialData?.reference ?? "",
      expected_at: initialData?.expected_at ?? today,
      payment_date: (initialData as any)?.payment_date ?? today,
      notes: (initialData as any)?.notes ?? "",
    } as any,
    validators: { onSubmit: purchaseOrderSchema.omit({ items: true } as any) },
    onSubmit: async ({ value }) => {
      if (items.length === 0) return setItemsError("Add at least one material");
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.material_id) return setItemsError(`Row ${i + 1}: select material`);
        const qtyNum = Number(it.qty);
        if (it.qty === "" || Number.isNaN(qtyNum) || qtyNum < 1)
          return setItemsError(`Row ${i + 1}: qty ≥1`);
        const costNum = Number(it.unit_cost);
        if (it.unit_cost === "" || Number.isNaN(costNum) || costNum < 0)
          return setItemsError(`Row ${i + 1}: unit cost invalid`);
      }
      // coerce to numbers for API (purchase-unit rows convert to base)
      const cleanItems = toBaseItems();
      setItemsError(null);
      const payload = { ...value, items: cleanItems };
      // validate items via zod
      const parsed = purchaseOrderSchema.safeParse(payload);
      if (!parsed.success) {
        setItemsError(parsed.error.issues[0]?.message);
        return;
      }
      if (isEdit) await updateMutation.mutateAsync(payload);
      else await createMutation.mutateAsync(payload);
    },
  });

  const updateItem = (idx: number, patch: Partial<POItem>) => {
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
  const onMaterialChange = (idx: number, materialId: string) => {
    const mat = materials?.find((m) => m.id === materialId);
    const inPurchase = mat ? hasPurchaseUom(mat) : false;
    updateItem(idx, {
      material_id: materialId,
      tax_percent: mat?.tax_percent,
      unit_cost: inPurchase
        ? Math.round((mat!.cost_price * rateFor(mat)) * 100) / 100
        : (mat?.cost_price ?? 0),
      entry_unit: inPurchase ? mat!.purchase_unit : mat?.unit,
    });
  };

  const supplierPreview = (() => {
    const sid = (form.getFieldValue("supplier_id" as any) as string) ?? initialData?.supplier_id;
    const s = suppliers?.find((x) => x.id === sid);
    if (!s) return null;
    return `${s.gstin ? `GSTIN ${s.gstin} • ` : ""}${s.phone} • ${s.email ?? ""}`;
  })();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        {/* Card 1 - Before Material */}
        <Card>
          <CardHeader>
            <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
            <CardDescription>
              Request to supplier — draft stays out of stock until Purchase Bill (GRN). Auto PO
              number <span className="font-mono">PO-YYYY-NNN</span>.
            </CardDescription>
            {initialData && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  PO Number <span className="font-mono font-medium">{initialData.po_number}</span> •
                  Status <span className="capitalize">{initialData.status}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const itemsText = initialData.items
                      .map(
                        (it) =>
                          `• ${it.material_name ?? it.material_id} ${it.qty}${(it as any).unit ?? ""} @₹${it.unit_cost} GST${(it as any).tax_percent ?? "-"}%`,
                      )
                      .join("\n");
                    const text = `Purchase Order ${initialData.po_number} from PixaPOS\nSupplier: ${initialData.supplier_name} (${initialData.supplier_id})\nPO Date: ${new Date(initialData.po_date).toLocaleDateString()} Ref: ${initialData.reference ?? "-"}\nDelivery: ${initialData.expected_at ? new Date(initialData.expected_at).toLocaleDateString() : "-"} Payment: ${(initialData as any).payment_date ? new Date((initialData as any).payment_date).toLocaleDateString() : "-"}\n\nItems:\n${itemsText}\nSubtotal: ₹${(initialData as any).subtotal} GST: ₹${(initialData as any).tax_amount} Total: ₹${initialData.total_amount}\nNotes: ${initialData.notes ?? "-"}`;
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: `PO ${initialData.po_number}`, text });
                        toast.success("PO shared");
                      } else if (navigator.clipboard) {
                        await navigator.clipboard.writeText(text);
                        toast.success("PO copied");
                      } else
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                    } catch {}
                  }}
                >
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
                  children={(field) => {
                    const value = field.state.value as string;
                    const selected = supplierOptions.find((o) => o.value === value);
                    const isInvalid = field.state.meta.errors.length > 0;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Supplier *</FieldLabel>
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button
                                id={field.name}
                                variant="outline"
                                role="combobox"
                                aria-invalid={isInvalid}
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !value && "text-muted-foreground",
                                )}
                              />
                            }
                          >
                            <span className="truncate text-left">
                              {selected?.label ?? "Search supplier (GSTIN/phone)…"}
                            </span>
                            <Icons.chevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </PopoverTrigger>
                          <PopoverContent className="w-[--anchor-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search name, GSTIN, phone..." />
                              <CommandList>
                                <CommandEmpty>No results • + New supplier</CommandEmpty>
                                <CommandGroup>
                                  {supplierOptions.slice(0, 50).map((opt) => (
                                    <CommandItem
                                      key={opt.value}
                                      value={opt.value}
                                      keywords={[opt.label]}
                                      onSelect={(v) => {
                                        field.handleChange(v);
                                        form.setFieldValue("supplier_id" as any, v);
                                      }}
                                    >
                                      <Icons.check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          value === opt.value ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      <span className="truncate">{opt.label}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FieldDescription>
                          {supplierPreview ?? "GSTIN & contact shown after selection"}
                        </FieldDescription>
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    );
                  }}
                />
                <form.AppField
                  name="po_date"
                  children={(field) => (
                    <field.TextField label="PO Date *" type="date" required placeholder={today} />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="reference"
                  children={(field) => (
                    <field.TextField
                      label="Reference #"
                      placeholder="IND-123"
                      description="Your indent/internal ref"
                    />
                  )}
                />
                <form.AppField
                  name="expected_at"
                  children={(field) => (
                    <field.TextField
                      label="Expected Delivery *"
                      type="date"
                      placeholder={today}
                      description="Default today"
                    />
                  )}
                />
              </div>
              <form.AppField
                name="payment_date"
                children={(field) => (
                  <field.TextField
                    label="Payment Date"
                    type="date"
                    placeholder={today}
                    description="Default today"
                  />
                )}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Card 2 - Material */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materials *</CardTitle>
            <CardDescription>
              Multi-item — rate defaults to last purchase price, GST per material.
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
                const uom = mat && hasPurchaseUom(mat);
                const entryUnit = (it.entry_unit as string) || mat?.unit || "";
                const inPurchase = !!uom && entryUnit === (mat as any)?.purchase_unit;
                const baseQty = inPurchase
                  ? (Number(it.qty) || 0) * rateFor(mat)
                  : Number(it.qty) || 0;
                const baseCost = inPurchase
                  ? (Number(it.unit_cost) || 0) / rateFor(mat)
                  : Number(it.unit_cost) || 0;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[1fr_90px_110px_80px_40px]"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Material {idx + 1}</Label>
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between font-normal",
                                !it.material_id && "text-muted-foreground",
                              )}
                            />
                          }
                        >
                          <span className="truncate text-left">
                            {it.material_id
                              ? (materialOptions.find((o) => o.value === it.material_id)?.label ??
                                "Select")
                              : "Search SKU or name…"}
                          </span>
                          <Icons.chevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[--anchor-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search SKU or name..." />
                            <CommandList>
                              <CommandEmpty>
                                <div className="flex flex-col items-center gap-1 py-2">
                                  <span>No results</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      window.open(
                                        "/dashboard/inventory/raw-materials/new",
                                        "_blank",
                                      )
                                    }
                                  >
                                    <Icons.add className="mr-1 h-3 w-3" /> New material
                                  </Button>
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {materialOptions
                                  .filter((opt) => {
                                    const sid =
                                      (form.getFieldValue("supplier_id" as any) as string) ?? "";
                                    if (!sid) return true;
                                    const mat = materials?.find((m) => m.id === opt.value);
                                    return (
                                      mat?.supplier_id === sid ||
                                      mat?.suppliers?.some((s) => s.supplier_id === sid)
                                    );
                                  })
                                  .slice(0, 50)
                                  .map((opt) => (
                                    <CommandItem
                                      key={opt.value}
                                      value={opt.value}
                                      keywords={[opt.label]}
                                      onSelect={(v) => onMaterialChange(idx, v)}
                                    >
                                      <Icons.check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          it.material_id === opt.value
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      <span className="truncate">{opt.label}</span>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {mat && (
                        <div className="text-[11px] text-muted-foreground">
                          {mat.unit} • Stock {mat.stock_qty} • Avg ₹{mat.avg_cost}
                          {uom &&
                            ` • Buys in ${(mat as any).purchase_unit} ×${rateFor(mat)}`}
                        </div>
                      )}
                      {uom && (
                        <div className="flex gap-1">
                          {[(mat as any).purchase_unit, mat.unit].map((u: string) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => updateItem(idx, { entry_unit: u })}
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[11px]",
                                entryUnit === u &&
                                  "border-primary bg-primary text-primary-foreground",
                              )}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Qty *{entryUnit ? ` (${entryUnit})` : ""}
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="50"
                        value={it.qty as any}
                        onChange={(e) =>
                          updateItem(idx, {
                            qty: (e.target.value === "" ? "" : Number(e.target.value)) as any,
                          })
                        }
                      />
                      {inPurchase ? (
                        <div className="text-[11px] text-muted-foreground">
                          → {baseQty} {mat.unit}
                        </div>
                      ) : (
                        mat && <div className="text-[11px] text-muted-foreground">{mat.unit}</div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Rate *{entryUnit ? ` (₹/${entryUnit})` : ""}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="80"
                        value={it.unit_cost as any}
                        onChange={(e) =>
                          updateItem(idx, {
                            unit_cost: (e.target.value === "" ? "" : Number(e.target.value)) as any,
                          })
                        }
                      />
                      <div className="text-[11px] text-muted-foreground">
                        ₹{((Number(it.qty) || 0) * (Number(it.unit_cost) || 0)).toFixed(0)} line
                        {inPurchase && ` • ₹${baseCost.toFixed(2)}/${mat.unit}`}
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
                        aria-label="Remove item"
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
            <p className="text-xs text-muted-foreground">
              Stock adds only on Purchase Bill (GRN), not on PO. Rate default is last purchase
              price.
            </p>
          </CardContent>
        </Card>

        {/* Card 3 - After Material */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes & Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldGroup>
              <form.AppField
                name="notes"
                children={(field) => (
                  <field.TextareaField
                    label="Supplier Note"
                    placeholder="Delivery instructions, gate pass, morning delivery 7am"
                    rows={2}
                    description="Visible to supplier if shared"
                  />
                )}
              />
            </FieldGroup>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              {initialData && isEdit && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    router.push(`/dashboard/inventory/purchases/new?poId=${initialData.id}`)
                  }
                >
                  <Icons.fileTypePdf className="mr-1 h-4 w-4" /> Convert to Purchase
                </Button>
              )}
              <form.AppForm
                children={
                  <form.SubmitButton>{isEdit ? "Update PO" : "Create PO"}</form.SubmitButton>
                }
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
