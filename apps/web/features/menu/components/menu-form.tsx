"use client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import { Field, FieldGroup, FieldLabel } from "@pixa/ui/base-ui/field";
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
import type { MenuItem, ProductType, ItemType } from "../api/types";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { useState, useRef } from "react";

type VariantForm = {
  name: string;
  sku: string;
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
  const [itemType, setItemType] = useState<ItemType>((initialData as any)?.item_type ?? "service");
  const initialImages: string[] =
    ((initialData as any)?.image_urls as string[]) ??
    ((initialData as any)?.images ? (initialData as any).images.map((i: any) => i.url) : []) ??
    ((initialData as any)?.image_url ? [(initialData as any).image_url] : []);
  const [images, setImages] = useState<string[]>(initialImages);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [variants, setVariants] = useState<VariantForm[]>(
    initialData?.variants.map((v) => ({
      name: v.name,
      sku: v.sku,
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

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (images.length + arr.length > 6) {
      toast.error("Max 6 images");
      return;
    }
    const valid: string[] = [];
    for (const f of arr) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: not an image`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name}: max 5MB`);
        continue;
      }
      valid.push(URL.createObjectURL(f));
    }
    if (valid.length) setImages((p) => [...p, ...valid].slice(0, 6));
  };
  const removeImage = (idx: number) => setImages((p) => p.filter((_, i) => i !== idx));
  const setPrimary = (idx: number) => setImages((p) => [p[idx], ...p.filter((_, i) => i !== idx)]);
  const moveImage = (idx: number, dir: -1 | 1) => {
    const n = idx + dir;
    if (n < 0 || n >= images.length) return;
    setImages((p) => {
      const c = [...p];
      const [v] = c.splice(idx, 1);
      c.splice(n, 0, v);
      return c;
    });
  };

  const createMut = useMutation({
    mutationFn: (v: any) =>
      createMenuItem({
        ...v,
        item_type: itemType,
        product_type: productType,
        image_urls: images,
        images: images.map((url, i) => ({ url, sort_order: i })),
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
        item_type: itemType,
        product_type: productType,
        image_urls: images,
        images: images.map((url, i) => ({ url, sort_order: i })),
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
      if (images.length > 6) return toast.error("Max 6 images");
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
      if (value.hsn_code) {
        if (itemType === "service" && !/^[0-9]{6}$/.test(value.hsn_code))
          return toast.error("Invalid SAC 6 digits for service (e.g., 996331)");
        if (itemType === "goods" && !/^[0-9]{4,8}$/.test(value.hsn_code))
          return toast.error("Invalid HSN 4-8 digits for goods");
      }
      setVariantsError(null);
      const payload = {
        ...value,
        veg_type: value.veg_type || "veg",
        product_type: productType,
        item_type: itemType,
      };
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
  const moveVariant = (idx: number, dir: -1 | 1) => {
    const n = idx + dir;
    if (n < 0 || n >= variants.length) return;
    setVariants((p) => {
      const c = [...p];
      const [v] = c.splice(idx, 1);
      c.splice(n, 0, v);
      return c;
    });
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
            <CardDescription>Dish — category, veg type, description.</CardDescription>
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
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Item Type *</Label>
                  <Select value={itemType} onValueChange={(v) => setItemType(v as ItemType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Service — Restaurant food (SAC)</SelectItem>
                      <SelectItem value="goods">Goods — Packaged (HSN)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {itemType === "goods"
                      ? "Supply of Goods — 5% / 18% (HSN)"
                      : "Supply of Service — 5% (SAC 996331)"}
                  </p>
                </div>
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
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Images — multi (max 6) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Images</CardTitle>
            <CardDescription>
              Up to 6 images. First is primary. Drag reorder with arrows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {images.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/50"
              >
                <Icons.upload className="mb-2 h-6 w-6" />
                Click to upload images (PNG/JPG/WebP, 5MB, max 6)
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {images.map((url, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "relative rounded-lg border p-2",
                      idx === 0 && "ring-2 ring-primary",
                    )}
                  >
                    <img
                      src={url}
                      alt={`image-${idx}`}
                      className="h-24 w-full rounded object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                        ★ Primary
                      </span>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => moveImage(idx, -1)}
                          disabled={idx === 0}
                          title="Move left"
                        >
                          <Icons.chevronUp className="h-3 w-3 rotate-[-90deg]" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => moveImage(idx, 1)}
                          disabled={idx === images.length - 1}
                          title="Move right"
                        >
                          <Icons.chevronUp className="h-3 w-3 rotate-90" />
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        {idx !== 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPrimary(idx)}
                            className="h-6 px-2 text-xs"
                          >
                            Set primary
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeImage(idx)}
                          className="h-6 w-6"
                        >
                          <Icons.trash className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {images.length < 6 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50"
                  >
                    <Icons.add className="mr-1 h-4 w-4" /> Add more
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {images.length}/6 images {images.length >= 6 && "— max reached"}
            </p>
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
                Flexible sizes — Small/Large/250ml/500ml/100gr etc. Toggle Active at row start.
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
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium">
                      #{idx + 1}
                    </span>
                    <Switch
                      checked={v.is_active ?? true}
                      onCheckedChange={(nv) => updateVariant(idx, { is_active: nv })}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        (v.is_active ?? true) ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {(v.is_active ?? true) ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs text-muted-foreground">— POS visible</span>
                    <div className="ml-auto flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveVariant(idx, -1)}
                        disabled={idx === 0}
                        title="Move up"
                      >
                        <Icons.chevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveVariant(idx, 1)}
                        disabled={idx === variants.length - 1}
                        title="Move down"
                      >
                        <Icons.chevronDown className="h-4 w-4" />
                      </Button>
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
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_140px_110px_90px_110px]">
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
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_140px_140px]">
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
              {itemType === "goods"
                ? "Goods: HSN + 5%/18% (Biscuits/Cookies/Chocolates). 5% Basic, 18% Premium."
                : "Service: SAC + 5% (Dine-in/Takeaway restaurant service)."}
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
                        <field.SelectField
                          label="GST Rate"
                          options={
                            itemType === "goods"
                              ? ([
                                  { label: "5% — Standard/Basic", value: "5" },
                                  { label: "12%", value: "12" },
                                  { label: "18% — Premium/Branded", value: "18" },
                                  { label: "28%", value: "28" },
                                ] as any)
                              : ([
                                  { label: "0% — Exempt", value: "0" },
                                  { label: "5% — Restaurant Service", value: "5" },
                                  { label: "18% — With ITC", value: "18" },
                                ] as any)
                          }
                          placeholder={itemType === "goods" ? "5 or 18" : "5"}
                        />
                      )}
                    />
                    <form.AppField
                      name="hsn_code"
                      children={(field) => (
                        <field.TextField
                          label={itemType === "goods" ? "HSN" : "SAC"}
                          placeholder={itemType === "goods" ? "19059040" : "996331"}
                          description={
                            itemType === "goods"
                              ? "4-8 digits (goods)"
                              : "6 digits (service) e.g., 996331 restaurant, 999732 packing"
                          }
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
                  courier.
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
