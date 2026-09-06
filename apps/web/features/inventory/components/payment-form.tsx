"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@pixa/ui/base-ui/field";
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
import { Icons } from "@pixa/ui/icons";
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createPayment } from "../api/service";
import { inventoryKeys, suppliersQueryOptions, purchasesQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";

const modeOptions = [
  { label: "Cash", value: "cash" },
  { label: "UPI", value: "upi" },
  { label: "Bank", value: "bank" },
  { label: "Credit", value: "credit" },
] as const;

export default function PaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSupplierId = searchParams.get("supplierId") ?? "";
  const prePurchaseId = searchParams.get("purchaseId") ?? "";
  const { data: suppliers } = useQuery(suppliersQueryOptions());
  const { data: purchases } = useQuery(purchasesQueryOptions());
  const supplierOptions = (suppliers ?? []).map((s) => ({
    label: `${s.name} (${s.phone})`,
    value: s.id,
  }));
  const purchaseOptions = (purchases ?? []).map((p) => ({
    label: `${p.purchase_number} — ${p.supplier_name} Due ₹${(p.total_amount - p.paid_amount).toFixed(2)}`,
    value: p.id,
  }));

  const createMut = useMutation({
    mutationFn: (v: any) => createPayment(v),
    onSuccess: (pay) => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success(`${pay.payment_number} posted`);
      router.push("/dashboard/inventory/payments");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: {
      supplier_id: preSupplierId,
      purchase_id: prePurchaseId,
      amount: 0 as any,
      payment_mode: "bank" as any,
      bill_date: new Date().toISOString().slice(0, 10),
      reference: "",
      notes: "",
    } as any,
    validators: {
      onSubmit: ({ value }: any) => {
        if (!value.supplier_id) return { supplier_id: "Supplier required" } as any;
        if (!value.amount || Number(value.amount) <= 0) return { amount: "Amount > 0" } as any;
        if (!value.bill_date) return { bill_date: "Date required" } as any;
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const payload = {
        ...value,
        amount: Number(value.amount),
        purchase_id: value.purchase_id || null,
      };
      await createMut.mutateAsync(payload);
    },
  });

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
            <CardTitle className="text-left text-2xl font-bold">New Payment</CardTitle>
            <CardDescription>
              Pay a purchase bill or advance to supplier. Purchase optional. Single posted, cancel
              to reverse.
            </CardDescription>
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
                                <CommandEmpty>No results</CommandEmpty>
                                <CommandGroup>
                                  {supplierOptions.slice(0, 50).map((opt) => (
                                    <CommandItem
                                      key={opt.value}
                                      value={opt.value}
                                      keywords={[opt.label]}
                                      onSelect={(v) => {
                                        field.handleChange(v);
                                        // clear purchase if supplier changes
                                        const curPur = form.getFieldValue(
                                          "purchase_id" as any,
                                        ) as string;
                                        if (curPur) {
                                          const pur = (purchases ?? []).find(
                                            (p) => p.id === curPur,
                                          );
                                          if (pur && pur.supplier_id !== v)
                                            form.setFieldValue("purchase_id" as any, "");
                                        }
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
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    );
                  }}
                />
                <form.AppField
                  name="payment_mode"
                  children={(field) => (
                    <field.SelectField
                      label="Mode *"
                      required
                      options={modeOptions as any}
                      placeholder="Select mode"
                    />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="purchase_id"
                  children={(field) => {
                    const value = field.state.value as string;
                    const selectedSupplierId =
                      (form.getFieldValue("supplier_id" as any) as string) ?? "";
                    const selected = purchaseOptions.find((o) => o.value === value);
                    const filtered = purchaseOptions.filter((opt) => {
                      const pur = (purchases ?? []).find((p) => p.id === opt.value);
                      if (!pur) return false;
                      if (pur.payment_status === "paid") return false;
                      if (selectedSupplierId && pur.supplier_id !== selectedSupplierId)
                        return false;
                      return true;
                    });
                    return (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Link Purchase (optional)</FieldLabel>
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button
                                id={field.name}
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !value && "text-muted-foreground",
                                )}
                              />
                            }
                          >
                            <span className="truncate text-left">
                              {selected?.label ??
                                (selectedSupplierId
                                  ? "Search purchase (PUR-... Due)…"
                                  : "Select supplier first or search all…")}
                            </span>
                            <Icons.chevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </PopoverTrigger>
                          <PopoverContent className="w-[--anchor-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search PUR-#, BILL date, Due..." />
                              <CommandList>
                                <CommandEmpty>No open bills • Try different supplier</CommandEmpty>
                                <CommandGroup>
                                  {filtered.slice(0, 50).map((opt) => (
                                    <CommandItem
                                      key={opt.value}
                                      value={opt.value}
                                      keywords={[opt.label]}
                                      onSelect={(v) => field.handleChange(v)}
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
                          Due is checked if linked{" "}
                          {selectedSupplierId ? "• Filtered to supplier" : ""}
                        </FieldDescription>
                      </Field>
                    );
                  }}
                />
                <form.AppField
                  name="amount"
                  children={(field) => (
                    <field.TextField
                      label="Amount *"
                      type="number"
                      placeholder="1000"
                      description="≤ Due if linked"
                    />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="bill_date"
                  children={(field) => <field.TextField label="Date *" type="date" required />}
                />
                <form.AppField
                  name="reference"
                  children={(field) => (
                    <field.TextField
                      label="Reference"
                      placeholder="UTR / txn id"
                      description="Bank UPI ref"
                    />
                  )}
                />
              </div>
              <form.AppField
                name="notes"
                children={(field) => (
                  <field.TextareaField label="Notes" placeholder="Payment notes" rows={2} />
                )}
              />
            </FieldGroup>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <form.AppForm children={<form.SubmitButton>Create & Post</form.SubmitButton>} />
        </div>
      </form>
    </div>
  );
}
