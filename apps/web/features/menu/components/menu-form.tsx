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
import { Popover, PopoverContent, PopoverTrigger } from "@pixa/ui/base-ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@pixa/ui/base-ui/command";
import { Textarea } from "@pixa/ui/base-ui/textarea";
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMenuItem, updateMenuItem } from "../api/service";
import { menuKeys, menuCategoriesQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { MenuItem, ProductType } from "../api/types";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { useState } from "react";

type VariantForm = {
  name: string;
  sku: string;
  label?: string;
  qty?: number | string;
  unit?: string;
  selling_price: number | string;
  compare_price?: number | string;
  barcode?: string;
  recipe_id?: string;
  is_default?: boolean;
  is_active?: boolean;
};

export default function MenuForm({
  initialData,
  pageTitle,
}: {
  initialData?: MenuItem | null;
  pageTitle?: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;
  const { data: categories } = useQuery(menuCategoriesQueryOptions());
  const categoryOptions = (categories ?? []).map((c) => ({ label: c.name, value: c.id }));

  const [productType, setProductType] = useState<ProductType>(
    (initialData?.product_type as ProductType) ??
      (initialData && initialData.variants.length > 1 ? "variant" : "simple"),
  );
  const [variants, setVariants] = useState<VariantForm[]>(
    initialData?.variants.map((v) => ({
      name: v.name,
      sku: v.sku,
      label: v.label,
      qty: v.qty,
      unit: v.unit,
      selling_price: v.selling_price,
      compare_price: (v as any).compare_price,
      barcode: (v as any).barcode,
      is_active: v.is_active,
    })) ?? [
      {
        name: "Regular",
        sku: "",
        label: "",
        selling_price: 0,
        qty: "",
        unit: "pcs",
        barcode: "",
        is_active: true,
      },
    ],
  );
  const [variantsError, setVariantsError] = useState<string | null>(null);
  const [availableChannels, setAvailableChannels] = useState<string[]>(
    initialData?.available_channels ?? ["dine_in", "pickup", "delivery"],
  );

  const createMut = useMutation({
    mutationFn: (v: any) =>
      createMenuItem({
        ...v,
        product_type: productType,
        variants:
          productType === "simple"
            ? [
                {
                  name: "Regular",
                  sku: variants[0]?.sku || "",
                  selling_price: Number(variants[0]?.selling_price ?? 0),
                  compare_price:
                    variants[0]?.compare_price === "" || variants[0]?.compare_price === undefined
                      ? undefined
                      : Number(variants[0]?.compare_price),
                  qty: variants[0]?.qty === "" ? undefined : Number(variants[0]?.qty),
                  unit: variants[0]?.unit,
                  barcode: variants[0]?.barcode,
                  is_active: true,
                },
              ]
            : variants.map((x) => ({
                ...x,
                selling_price: Number(x.selling_price),
                compare_price:
                  x.compare_price === "" || x.compare_price === undefined
                    ? undefined
                    : Number(x.compare_price),
                qty: x.qty === "" ? undefined : Number(x.qty),
              })),
        available_channels: availableChannels,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: menuKeys.all });
      toast.success("Menu item created");
      router.push("/dashboard/menu/items");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (v: any) =>
      updateMenuItem(initialData!.id, {
        ...v,
        product_type: productType,
        variants:
          productType === "simple"
            ? [
                {
                  name: "Regular",
                  sku: variants[0]?.sku || "",
                  selling_price: Number(variants[0]?.selling_price ?? 0),
                  compare_price:
                    variants[0]?.compare_price === "" || variants[0]?.compare_price === undefined
                      ? undefined
                      : Number(variants[0]?.compare_price),
                  qty: variants[0]?.qty === "" ? undefined : Number(variants[0]?.qty),
                  unit: variants[0]?.unit,
                  barcode: variants[0]?.barcode,
                  is_active: true,
                },
              ]
            : variants.map((x) => ({
                ...x,
                selling_price: Number(x.selling_price),
                compare_price:
                  x.compare_price === "" || x.compare_price === undefined
                    ? undefined
                    : Number(x.compare_price),
                qty: x.qty === "" ? undefined : Number(x.qty),
              })),
        available_channels: availableChannels,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: menuKeys.all });
      toast.success("Menu item updated");
      router.push("/dashboard/menu/items");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? "",
      category_id: initialData?.category_id ?? "",
      description: initialData?.description ?? "",
      veg_type: (initialData?.veg_type as any) ?? "veg",
      spice_level: (initialData as any)?.spice_level ?? "",
      prep_time_min: initialData?.prep_time_min ?? 15,
      taxable: initialData?.taxable ?? false,
      tax_type: (initialData as any)?.tax_type ?? "GST",
      tax_percent: initialData?.tax_percent ?? 5,
      hsn_code: initialData?.hsn_code ?? "",
      is_active: initialData?.is_active ?? true,
    } as any,
    validators: {
      onSubmit: ({ value }: any) => {
        if (!value.name) return { name: "Name required" } as any;
        if (!value.category_id) return { category_id: "Category required" } as any;
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const toValidate = productType === "simple" ? [variants[0]] : variants;
      if (productType === "variant" && toValidate.length === 0)
        return setVariantsError("Add at least one variant");
      if (productType === "variant" && toValidate.length > 8)
        return setVariantsError("Max 8 variants per item");
      for (let i = 0; i < toValidate.length; i++) {
        const v = toValidate[i];
        if (productType === "variant" && !v.name)
          return setVariantsError(`Variant ${i + 1}: name required (Small/Large/250ml)`);
        if (!v.sku)
          return setVariantsError(
            `${productType === "simple" ? "SKU" : `Variant ${i + 1}: SKU`} required`,
          );
        const p = Number(v.selling_price);
        if (v.selling_price === "" || Number.isNaN(p) || p < 0)
          return setVariantsError(
            `${productType === "simple" ? "Price" : `Variant ${i + 1}: price`} ≥0`,
          );
      }
      setVariantsError(null);
      const payload = { ...value, veg_type: value.veg_type || "veg", product_type: productType };
      if (isEdit) await updateMut.mutateAsync(payload);
      else await createMut.mutateAsync(payload);
    },
  });

  const addVariant = () => {
    if (variants.length >= 8) return toast.error("Max 8 variants");
    setVariants((p) => [
      ...p,
      {
        name: "",
        sku: "",
        label: "",
        selling_price: 0,
        qty: "",
        unit: "pcs",
        barcode: "",
        is_active: true,
      },
    ]);
  };
  const updateVariant = (idx: number, patch: Partial<VariantForm>) =>
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  const removeVariant = (idx: number) => {
    if (variants.length === 1) return toast.error("At least one variant required");
    setVariants((p) => p.filter((_, i) => i !== idx));
  };
  const toggleChannel = (ch: string) =>
    setAvailableChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        {/* Card 1 - General */}
        <Card>
          <CardHeader>
            <CardTitle className="text-left text-2xl font-bold">
              {pageTitle ?? (isEdit ? "Update Menu Item" : "New Menu Item")}
            </CardTitle>
            <CardDescription>
              Dish — searchable category, veg, description. Image placeholder not used this phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldGroup>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="name"
                  children={(field) => (
                    <field.TextField label="Name *" required placeholder="Chicken Biryani" />
                  )}
                />
                <form.AppField
                  name="category_id"
                  children={(field) => {
                    const value = field.state.value as string;
                    const sel = categoryOptions.find((o) => o.value === value);
                    return (
                      <Field>
                        <FieldLabel>Category *</FieldLabel>
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button
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
                              {sel?.label ?? "Search category…"}
                            </span>
                            <Icons.chevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </PopoverTrigger>
                          <PopoverContent className="w-[--anchor-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search category..." />
                              <CommandList>
                                <CommandEmpty>No results</CommandEmpty>
                                <CommandGroup>
                                  {categoryOptions.slice(0, 50).map((opt) => (
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
                      </Field>
                    );
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="veg_type"
                  children={(field) => (
                    <field.SelectField
                      label="Veg Type *"
                      required
                      options={[
                        { label: "Veg", value: "veg" },
                        { label: "Non-veg", value: "nonveg" },
                        { label: "Egg", value: "egg" },
                      ]}
                      placeholder="Select"
                    />
                  )}
                />
                <form.AppField
                  name="spice_level"
                  children={(field) => (
                    <field.SelectField
                      label="Spice"
                      options={[
                        { label: "Mild", value: "mild" },
                        { label: "Medium", value: "medium" },
                        { label: "Spicy", value: "spicy" },
                      ]}
                      placeholder="Select"
                    />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="prep_time_min"
                  children={(field) => (
                    <field.TextField label="Prep Time (min)" type="number" placeholder="15" />
                  )}
                />
                <form.AppField
                  name="is_active"
                  children={(field) => (
                    <field.SwitchField label="Active" description="Visible in POS" />
                  )}
                />
              </div>
              <form.AppField
                name="description"
                children={(field) => (
                  <field.TextareaField
                    label="Description"
                    placeholder="Hyderabadi dum..."
                    rows={2}
                  />
                )}
              />
              <div className="rounded-lg border border-dashed p-6 text-center">
                <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                  <Icons.upload className="size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">Image upload placeholder</p>
                  <p className="text-xs text-muted-foreground">
                    Not used this phase — will store image_url later
                  </p>
                  <Button type="button" variant="outline" size="sm" disabled>
                    Upload image (coming soon)
                  </Button>
                </div>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Product Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Type</CardTitle>
            <CardDescription>
              Simple = no variants (Idly), Variant = has variants like Small/Large/250ml
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={productType === "simple" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setProductType("simple");
                  setVariants((prev) => [
                    prev[0] ?? {
                      name: "Regular",
                      sku: "",
                      selling_price: 0,
                      qty: "",
                      unit: "pcs",
                      barcode: "",
                      is_active: true,
                    },
                  ]);
                }}
              >
                Simple
              </Button>
              <Button
                type="button"
                variant={productType === "variant" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setProductType("variant");
                  if (variants.length === 1 && variants[0].name === "Regular") {
                    setVariants([
                      {
                        name: "Small",
                        sku: "",
                        selling_price: 0,
                        qty: "",
                        unit: "pcs",
                        barcode: "",
                        is_active: true,
                      },
                      {
                        name: "Large",
                        sku: "",
                        selling_price: 0,
                        qty: "",
                        unit: "pcs",
                        barcode: "",
                        is_active: true,
                      },
                    ]);
                  }
                }}
              >
                Variant
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {productType === "simple"
                ? "No variants — direct sell like Idly ₹40"
                : "Has variants — e.g., Pizza Small/Medium/Large, Coke 250ml/500ml"}
            </p>
          </CardContent>
        </Card>

        {/* Card Variants - conditional */}
        {productType === "simple" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
              <CardDescription>Simple item — SKU + Price</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_140px_1fr]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">SKU *</Label>
                <Input
                  placeholder="IDLY-001"
                  value={variants[0]?.sku ?? ""}
                  onChange={(e) => updateVariant(0, { sku: e.target.value, name: "Regular" })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Price *</Label>
                <Input
                  type="number"
                  min={0}
                  value={(variants[0]?.selling_price as any) ?? ""}
                  onChange={(e) =>
                    updateVariant(0, {
                      selling_price: e.target.value === "" ? "" : (Number(e.target.value) as any),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Barcode</Label>
                <Input
                  placeholder="890123..."
                  value={variants[0]?.barcode ?? ""}
                  onChange={(e) => updateVariant(0, { barcode: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Compare Price</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="299"
                  value={(variants[0]?.compare_price as any) ?? ""}
                  onChange={(e) =>
                    updateVariant(0, {
                      compare_price: e.target.value === "" ? "" : (Number(e.target.value) as any),
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Variants *</CardTitle>
              <CardDescription>
                Flexible sizes — Small/Large/250ml/500ml/100gr etc. User creates different types.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{variants.length}/8 variants</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariant}
                  disabled={variants.length >= 8}
                >
                  <Icons.add className="mr-1 h-4 w-4" /> Add Variant
                </Button>
              </div>
              {variants.map((v, idx) => (
                <div key={idx} className="space-y-3 rounded-lg border p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_140px_110px_90px_90px_40px]">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name *</Label>
                      <Input
                        placeholder="Small / 250ml"
                        value={v.name}
                        onChange={(e) => updateVariant(idx, { name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">SKU *</Label>
                      <Input
                        placeholder="BIRY-SM-001"
                        value={v.sku}
                        onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        placeholder="250"
                        value={v.qty as any}
                        onChange={(e) =>
                          updateVariant(idx, {
                            qty: e.target.value === "" ? "" : (Number(e.target.value) as any),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <Select
                        value={v.unit ?? "pcs"}
                        onValueChange={(nv) => updateVariant(idx, { unit: nv })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pcs">pcs</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="gr">gr</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="l">l</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Price *</Label>
                      <Input
                        type="number"
                        min={0}
                        value={v.selling_price as any}
                        onChange={(e) =>
                          updateVariant(idx, {
                            selling_price:
                              e.target.value === "" ? "" : (Number(e.target.value) as any),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeVariant(idx)}
                        disabled={variants.length === 1}
                      >
                        <Icons.trash className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_140px_140px_1fr]">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Label</Label>
                      <Input
                        placeholder="250ml display"
                        value={v.label ?? ""}
                        onChange={(e) => updateVariant(idx, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Barcode</Label>
                      <Input
                        placeholder="890123..."
                        value={v.barcode ?? ""}
                        onChange={(e) => updateVariant(idx, { barcode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Compare Price</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="299"
                        value={(v.compare_price as any) ?? ""}
                        onChange={(e) =>
                          updateVariant(idx, {
                            compare_price:
                              e.target.value === "" ? "" : (Number(e.target.value) as any),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-1 text-xs">
                        <Switch
                          checked={v.is_active ?? true}
                          onCheckedChange={(nv) => updateVariant(idx, { is_active: nv })}
                        />{" "}
                        Active
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              {variantsError && <p className="text-sm text-destructive">{variantsError}</p>}
            </CardContent>
          </Card>
        )}

        {/* Card 3 - Tax, Channels & Availability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tax & Channels</CardTitle>
            <CardDescription>
              Optional GST, channels dine-in/pickup/delivery + aggregators zomato/swiggy/ondc.
              Single menu via flags.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldGroup>
              <form.AppField
                name="taxable"
                children={(field) => (
                  <field.SwitchField label="Taxable (GST)" description="Toggle GST for this item" />
                )}
              />
              {(form.getFieldValue("taxable" as any) as boolean) && (
                <>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <form.AppField
                      name="tax_type"
                      children={(field) => (
                        <field.SelectField
                          label="Tax Type"
                          options={[
                            { label: "GST", value: "GST" },
                            { label: "VAT", value: "VAT" },
                          ]}
                          placeholder="GST"
                        />
                      )}
                    />
                    <form.AppField
                      name="tax_percent"
                      children={(field) => (
                        <field.TextField label="Tax %" type="number" placeholder="5" />
                      )}
                    />
                    <form.AppField
                      name="hsn_code"
                      children={(field) => (
                        <field.TextField
                          label="HSN"
                          placeholder="21069030"
                          description="4-8 digits"
                        />
                      )}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Available Channels</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["dine_in", "Dine-in"],
                      ["pickup", "Takeaway"],
                      ["delivery", "Delivery"],
                      ["zomato", "Zomato"],
                      ["swiggy", "Swiggy"],
                      ["ondc", "ONDC"],
                    ] as const
                  ).map(([val, label]) => (
                    <label
                      key={val}
                      className={cn(
                        "flex items-center gap-1.5 rounded border px-2 py-1 text-xs",
                        availableChannels.includes(val) &&
                          "bg-primary text-primary-foreground border-primary",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={availableChannels.includes(val)}
                        onChange={() => toggleChannel(val)}
                        className="sr-only"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Single menu, channel flags — Takeaway = Pickup (counter), Dine-in table, Delivery
                  courier. No-variant items use 1 Regular variant.
                </p>
              </div>
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <form.AppForm
                children={<form.SubmitButton>{isEdit ? "Update" : "Create"}</form.SubmitButton>}
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
