"use client";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Switch } from "@pixa/ui/base-ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPurchaseReturn } from "../api/service";
import {
  inventoryKeys,
  purchasesQueryOptions,
  purchaseQueryOptions,
  purchaseReturnsQueryOptions,
  suppliersQueryOptions,
} from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { Popover, PopoverContent, PopoverTrigger } from "@pixa/ui/base-ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@pixa/ui/base-ui/command";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";

const REASONS = [
  { label: "Damaged", value: "damaged" },
  { label: "Expired", value: "expired" },
  { label: "Short Supply", value: "short_supply" },
  { label: "Wrong Item", value: "wrong_item" },
  { label: "Quality", value: "quality" },
  { label: "Other", value: "other" },
] as const;

type ReturnLine = {
  material_id: string;
  material_name?: string;
  qty_original: number;
  qty_returned: number | string;
  unit_cost: number;
  tax_percent?: number;
  returnable: number;
};

export default function PurchaseReturnForm({ purchaseId }: { purchaseId?: string }) {
  const router = useRouter();
  const { data: purchases } = useQuery(purchasesQueryOptions());
  const { data: suppliers } = useQuery(suppliersQueryOptions());
  const { data: allReturns } = useQuery(purchaseReturnsQueryOptions());
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>(purchaseId ?? "");
  const { data: purchase } = useQuery({
    ...purchaseQueryOptions(selectedPurchaseId),
    enabled: !!selectedPurchaseId,
  });

  const returnableMap = useMemo(() => {
    if (!purchase) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const it of purchase.items) {
      const orig = it.qty;
      const already = (allReturns ?? [])
        .filter((r) => r.purchase_id === purchase.id && r.status === "approved")
        .flatMap((r) => r.items)
        .filter((x) => x.material_id === it.material_id)
        .reduce((s, x) => s + x.qty_returned, 0);
      map.set(it.material_id, Math.max(0, orig - already));
    }
    return map;
  }, [purchase, allReturns]);

  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // init lines when purchase loads
  const initKey = purchase?.id ?? "";
  // use memo to derive initial lines if not yet set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (purchase && lines.length === 0) {
      setLines(
        purchase.items.map((it) => ({
          material_id: it.material_id,
          material_name: it.material_name,
          qty_original: it.qty,
          qty_returned: 0,
          unit_cost: it.unit_cost,
          tax_percent: it.tax_percent,
          returnable: returnableMap.get(it.material_id) ?? it.qty,
        })),
      );
    }
    if (!purchase && lines.length > 0 && !selectedPurchaseId) setLines([]);
    // trigger when purchase changes
  }, [initKey]);

  // update returnable when map changes
  useMemo(() => {
    if (lines.length > 0 && purchase) {
      setLines((prev) =>
        prev.map((l) => ({ ...l, returnable: returnableMap.get(l.material_id) ?? l.qty_original })),
      );
    }
  }, [returnableMap]);

  const totals = useMemo(() => {
    let sub = 0,
      tax = 0;
    for (const l of lines) {
      const q = Number(l.qty_returned) || 0;
      sub += q * l.unit_cost;
      tax += q * l.unit_cost * ((l.tax_percent ?? 0) / 100);
    }
    sub = Math.round(sub * 100) / 100;
    tax = Math.round(tax * 100) / 100;
    return { sub, tax, total: Math.round((sub + tax) * 100) / 100 };
  }, [lines]);

  const supplierOptions = (suppliers ?? []).map((s) => ({
    label: `${s.name} — ${s.gstin ?? s.phone}`,
    value: s.id,
  }));
  const purchaseOptions = (purchases ?? [])
    .filter((p) => {
      if (selectedSupplierId) return p.supplier_id === selectedSupplierId;
      return true;
    })
    .filter((p) => {
      // only returnable bills like Odoo -- at least one item with returnable >0
      // if not loaded allReturns yet, show all
      if (!allReturns) return true;
      return p.items.some((it) => {
        const orig = it.qty;
        const already = (allReturns ?? [])
          .filter((r) => r.purchase_id === p.id && r.status === "approved")
          .flatMap((r) => r.items)
          .filter((x) => x.material_id === it.material_id)
          .reduce((s, x) => s + x.qty_returned, 0);
        return orig - already > 0;
      });
    })
    .map((p) => ({
      label: `${p.purchase_number} — ${p.supplier_name} (${p.payment_status}) • ₹${p.total_amount} • ${new Date(p.bill_date).toLocaleDateString()}`,
      value: p.id,
    }));

  const createMut = useMutation({
    mutationFn: (vals: any) =>
      createPurchaseReturn({
        purchase_id: selectedPurchaseId,
        reason: vals.reason,
        notes: vals.notes,
        bill_date: vals.bill_date,
        restock,
        items: lines
          .filter((l) => Number(l.qty_returned) > 0)
          .map((l) => ({
            material_id: l.material_id,
            qty_returned: Number(l.qty_returned),
          })) as any,
      } as any),
    onSuccess: (ret) => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success(`Return ${ret.return_number} created as draft — approve to post`);
      router.push("/dashboard/inventory/returns");
    },
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

  const form = useAppForm({
    defaultValues: {
      reason: "" as any,
      notes: "",
      bill_date: new Date().toISOString().slice(0, 10),
    } as any,
    validators: {
      onSubmit: ({ value }: any) => {
        if (!selectedPurchaseId) return { purchase_id: "Select purchase" } as any;
        if (!value.reason) return { reason: "Reason required" } as any;
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      if (!selectedPurchaseId) return setError("Select original purchase");
      const toReturn = lines.filter((l) => Number(l.qty_returned) > 0);
      if (toReturn.length === 0) return setError("Enter at least one return qty");
      for (const l of toReturn) {
        const q = Number(l.qty_returned);
        if (!Number.isFinite(q) || q < 1) return setError(`${l.material_name}: qty ≥1`);
        if (q > l.returnable)
          return setError(`${l.material_name}: exceeds returnable ${l.returnable}`);
      }
      setError(null);
      await createMut.mutateAsync(value);
    },
  });

  const handlePurchaseChange = (pid: string) => {
    setSelectedPurchaseId(pid);
    const pur = (purchases ?? []).find((p) => p.id === pid);
    if (pur) setSelectedSupplierId(pur.supplier_id);
    setLines([]);
    setError(null);
  };
  const handleSupplierChange = (sid: string) => {
    setSelectedSupplierId(sid);
    setSelectedPurchaseId("");
    setLines([]);
    setError(null);
  };
  useEffect(() => {
    if (purchase && !selectedSupplierId) setSelectedSupplierId(purchase.supplier_id);
  }, [purchase, selectedSupplierId]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-left text-2xl font-bold">Create Purchase Return</CardTitle>
            <CardDescription>
              Credit Note for purchase — partial or full. Approved deducts stock (if Restock) and
              acts as vendor credit. Odoo: reverse entry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Supplier *</Label>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between font-normal",
                            !selectedSupplierId && "text-muted-foreground",
                          )}
                        />
                      }
                    >
                      <span className="truncate text-left">
                        {selectedSupplierId
                          ? (supplierOptions.find((o) => o.value === selectedSupplierId)?.label ??
                            "Select")
                          : "Search supplier (GSTIN/phone)…"}
                      </span>
                      <Icons.chevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[--anchor-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search supplier..." />
                        <CommandList>
                          <CommandEmpty>No results</CommandEmpty>
                          <CommandGroup>
                            {supplierOptions.map((opt) => (
                              <CommandItem
                                key={opt.value}
                                value={opt.value}
                                keywords={[opt.label]}
                                onSelect={(v) => handleSupplierChange(v)}
                              >
                                <Icons.check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedSupplierId === opt.value ? "opacity-100" : "opacity-0",
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
                  {selectedSupplierId ? (
                    <p className="text-xs text-muted-foreground">
                      Filtered •{" "}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1"
                        onClick={() => handleSupplierChange("")}
                      >
                        Clear supplier filter
                      </Button>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Pick supplier first — purchase list narrows like Odoo/Zoho (1k → 80).
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Original Purchase *</Label>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between font-normal",
                            !selectedPurchaseId && "text-muted-foreground",
                          )}
                          disabled={!selectedSupplierId && (purchases ?? []).length > 100}
                        />
                      }
                    >
                      <span className="truncate text-left">
                        {selectedPurchaseId
                          ? (purchaseOptions.find((o) => o.value === selectedPurchaseId)?.label ??
                            purchase?.purchase_number ??
                            "Select")
                          : selectedSupplierId
                            ? "Search purchase (PUR-... bill date)…"
                            : "Select supplier first or search all…"}
                      </span>
                      <Icons.chevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[--anchor-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search PUR-#, bill date, supplier..." />
                        <CommandList>
                          <CommandEmpty>No returnable bills • Try different supplier</CommandEmpty>
                          <CommandGroup>
                            {purchaseOptions.slice(0, 50).map((opt) => (
                              <CommandItem
                                key={opt.value}
                                value={opt.value}
                                keywords={[opt.label]}
                                onSelect={(v) => handlePurchaseChange(v)}
                              >
                                <Icons.check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedPurchaseId === opt.value ? "opacity-100" : "opacity-0",
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
                  {purchase && (
                    <p className="text-xs text-muted-foreground">
                      {purchase.purchase_number} • {purchase.supplier_name} • Bill{" "}
                      {new Date(purchase.bill_date).toLocaleDateString()} • Total ₹
                      {purchase.total_amount} {selectedSupplierId ? `• Filtered to supplier` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="reason"
                  children={(field) => (
                    <field.SelectField
                      label="Reason *"
                      required
                      options={REASONS as any}
                      placeholder="Select reason"
                    />
                  )}
                />
                <form.AppField
                  name="bill_date"
                  children={(field) => (
                    <field.TextField label="Return Date" type="date" description="Defaults today" />
                  )}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Restock</Label>
                  <p className="text-xs text-muted-foreground">
                    If off, credit only — stock unchanged (write-off / quality not returned)
                  </p>
                </div>
                <Switch checked={restock} onCheckedChange={setRestock} />
              </div>
              <form.AppField
                name="notes"
                children={(field) => (
                  <field.TextareaField
                    label="Notes"
                    placeholder="LR no / transporter / damage details"
                    rows={2}
                  />
                )}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        {purchase && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items to Return</CardTitle>
              <CardDescription>
                Enter qty to return per line — max is returnable (original − already returned). At
                least one &gt;0.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                {lines.map((l, idx) => (
                  <div
                    key={l.material_id}
                    className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[1fr_110px_110px_90px]"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Material</Label>
                      <div className="text-sm font-medium">{l.material_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Original {l.qty_original} • Already returned {l.qty_original - l.returnable}{" "}
                        • Returnable {l.returnable}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Rate ₹{l.unit_cost} GST {l.tax_percent ?? 0}%
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Qty to Return</Label>
                      <Input
                        type="number"
                        min={0}
                        max={l.returnable}
                        value={l.qty_returned as any}
                        onChange={(e) => {
                          const v = e.target.value === "" ? ("" as any) : Number(e.target.value);
                          setLines((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, qty_returned: v } : x)),
                          );
                          setError(null);
                        }}
                      />
                      <div className="text-[11px] text-muted-foreground">Max {l.returnable}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Refund</Label>
                      <div className="text-sm">
                        ₹
                        {(
                          (Number(l.qty_returned) || 0) *
                          l.unit_cost *
                          (1 + (l.tax_percent ?? 0) / 100)
                        ).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Sub ₹{((Number(l.qty_returned) || 0) * l.unit_cost).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setLines((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, qty_returned: x.returnable } : x,
                            ),
                          )
                        }
                        disabled={l.returnable === 0}
                      >
                        Full
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal Refund</span>
                  <span>₹{totals.sub.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST Refund</span>
                  <span>₹{totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total Credit</span>
                  <span>₹{totals.total.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shown as Vendor Credit; reverse journal on approve.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <form.AppForm
            children={
              <form.SubmitButton disabled={!purchase || createMut.isPending}>
                {createMut.isPending ? "Creating..." : "Create Draft Return"}
              </form.SubmitButton>
            }
          />
        </div>
      </form>
    </div>
  );
}
