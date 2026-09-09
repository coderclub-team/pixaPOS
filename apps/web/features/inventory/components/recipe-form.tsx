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
import { useAppForm } from "@/lib/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRecipe, updateRecipe } from "../api/service";
import { inventoryKeys, rawMaterialsQueryOptions } from "../api/queries";
import { menuItemsQueryOptions } from "@/features/menu/api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { Recipe } from "../api/types";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { useState } from "react";
import { SortableList, SortableItem, SortableItemHandle } from "@pixa/ui/base-ui/sortable";

const uid = () => `r_${Math.random().toString(36).slice(2, 10)}`;

type IngVariantQty = { variant_id: string; variant_name: string; qty: number | string };

type IngForm = {
  _uid: string;
  material_id: string;
  qty: number | string;
  unit: string;
  wastage_percent?: number | string;
  step_no?: number | string;
  variant_qtys: IngVariantQty[];
};

type StepForm = {
  _uid: string;
  id?: string;
  instruction: string;
  vessel?: string;
  vessel_note?: string;
  temperature_c?: number | string;
  heat_level?: string;
  duration_min?: number | string;
  image_url?: string;
  is_optional?: boolean;
};

const VESSELS = [
  "kadai",
  "handi",
  "tawa",
  "pressure_cooker",
  "oven",
  "tandoor",
  "steamer",
  "wok",
  "pan",
  "pot",
  "grill",
  "fryer",
  "other",
] as const;
const UNITS = ["kg", "g", "l", "ml", "pcs", "box"] as const;

export default function RecipeForm({
  initialData,
  pageTitle,
}: {
  initialData: Recipe | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;
  const { data: materials } = useQuery(rawMaterialsQueryOptions());
  const materialOptions = (materials ?? []).map((m) => ({
    label: `${m.name} (${m.sku}) — ₹${m.avg_cost}/${m.unit}`,
    value: m.id,
  }));
  const matById = Object.fromEntries((materials ?? []).map((m) => [m.id, m]));
  const { data: menuItems } = useQuery(menuItemsQueryOptions({}));
  const [linkedMenuItemId, setLinkedMenuItemId] = useState<string>(
    (initialData as any)?.menu_item_id ?? "",
  );
  const linkedItem = (menuItems ?? []).find((m) => m.id === linkedMenuItemId);
  const variantCols =
    linkedItem && linkedItem.variants.length > 1 ? linkedItem.variants : [];

  const [ingredients, setIngredients] = useState<IngForm[]>(
    initialData?.ingredients.map((ing) => ({
      _uid: uid(),
      material_id: ing.material_id,
      qty: ing.qty,
      unit: ing.unit,
      wastage_percent: ing.wastage_percent ?? "",
      step_no: ing.step_no ?? "",
      variant_qtys: (ing.variant_qtys ?? []).map((vq) => ({ ...vq })),
    })) ?? [
      { _uid: uid(), material_id: "", qty: 0.2, unit: "kg", wastage_percent: "", step_no: "", variant_qtys: [] },
    ],
  );
  const [steps, setSteps] = useState<StepForm[]>(
    (initialData?.steps ?? []).map((s) => ({
      _uid: uid(),
      id: s.id,
      instruction: s.instruction,
      vessel: s.vessel,
      vessel_note: s.vessel_note ?? "",
      temperature_c: s.temperature_c ?? "",
      heat_level: s.heat_level ?? "",
      duration_min: s.duration_min ?? "",
      image_url: (s as any).image_url ?? "",
      is_optional: s.is_optional ?? false,
    })),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const lineQtyFor = (ing: IngForm, variantId?: string) => {
    if (!variantId) return Number(ing.qty) || 0;
    const o = ing.variant_qtys.find((vq) => vq.variant_id === variantId);
    if (o && o.qty !== "") return Number(o.qty) || 0;
    return Number(ing.qty) || 0;
  };
  const batchCost = ingredients.reduce((sum, ing) => {
    const mat = matById[ing.material_id];
    const q = Number(ing.qty) || 0;
    const w = Number(ing.wastage_percent) || 0;
    return sum + q * (mat?.avg_cost ?? 0) * (1 + w / 100);
  }, 0);
  const variantCosts = variantCols.map((v) => ({
    variant_id: v.id,
    variant_name: v.name,
    cost:
      Math.round(
        ingredients.reduce((sum, ing) => {
          const mat = matById[ing.material_id];
          const w = Number(ing.wastage_percent) || 0;
          return sum + lineQtyFor(ing, v.id) * (mat?.avg_cost ?? 0) * (1 + w / 100);
        }, 0) * 100,
      ) / 100,
  }));

  const mapIngredients = () =>
    ingredients.map((ing) => ({
      material_id: ing.material_id,
      qty: Number(ing.qty),
      unit: ing.unit,
      wastage_percent: ing.wastage_percent === "" ? undefined : Number(ing.wastage_percent),
      step_no: ing.step_no === "" ? undefined : Number(ing.step_no),
      variant_qtys:
        variantCols.length > 0
          ? variantCols.map((v) => {
              const o = ing.variant_qtys.find((vq) => vq.variant_id === v.id);
              const q = o && o.qty !== "" ? Number(o.qty) : Number(ing.qty);
              return { variant_id: v.id, variant_name: v.name, qty: q };
            })
          : undefined,
    }));
  const mapSteps = () =>
    steps.map((s) => ({
      id: s.id,
      instruction: s.instruction,
      vessel: (s.vessel || undefined) as any,
      vessel_note: s.vessel_note || undefined,
      temperature_c: s.temperature_c === "" ? undefined : Number(s.temperature_c),
      heat_level: (s.heat_level || undefined) as any,
      duration_min: s.duration_min === "" ? undefined : Number(s.duration_min),
      image_url: s.image_url || undefined,
      is_optional: s.is_optional ?? false,
    }));

  const createMutation = useMutation({
    mutationFn: (v: any) =>
      createRecipe({
        ...v,
        menu_item_id: linkedMenuItemId || undefined,
        ingredients: mapIngredients(),
        steps: mapSteps(),
      } as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Recipe created");
      router.push("/dashboard/inventory/recipes");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: (v: any) =>
      updateRecipe(initialData!.id, {
        ...v,
        menu_item_id: linkedMenuItemId || undefined,
        ingredients: mapIngredients(),
        steps: mapSteps(),
      } as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Recipe updated");
      router.push("/dashboard/inventory/recipes");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? "",
      yields: initialData?.yields ?? 1,
      yield_unit: (initialData as any)?.yield_unit ?? "serves",
      selling_price: initialData?.selling_price ?? 0,
      prep_time_min: (initialData as any)?.prep_time_min ?? "",
      cook_time_min: (initialData as any)?.cook_time_min ?? "",
      plating_notes: (initialData as any)?.plating_notes ?? "",
      garnish: (initialData as any)?.garnish ?? "",
      serving_vessel: (initialData as any)?.serving_vessel ?? "",
      is_active: initialData?.is_active ?? true,
    } as any,
    validators: {
      onSubmit: ({ value }: any) => {
        if (!value.name) return { name: "Name required" } as any;
        if (!value.yields || Number(value.yields) < 1) return { yields: "Yields ≥ 1" } as any;
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      if (ingredients.length === 0) return setFormError("Add at least one ingredient");
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        if (!ing.material_id) return setFormError(`Ingredient ${i + 1}: material required`);
        if (ing.qty === "" || Number.isNaN(Number(ing.qty)) || Number(ing.qty) <= 0)
          return setFormError(`Ingredient ${i + 1}: qty > 0`);
        for (const vq of ing.variant_qtys) {
          if (vq.qty === "" || Number.isNaN(Number(vq.qty)) || Number(vq.qty) < 0)
            return setFormError(`Ingredient ${i + 1}: ${vq.variant_name} qty ≥ 0`);
        }
      }
      if (steps.length > 20) return setFormError("Max 20 steps");
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (!s.instruction.trim()) return setFormError(`Step ${i + 1}: instruction required`);
        if (s.temperature_c !== "" && (Number(s.temperature_c) < 0 || Number(s.temperature_c) > 300))
          return setFormError(`Step ${i + 1}: temp 0–300°C`);
      }
      setFormError(null);
      const payload = {
        ...value,
        yields: Number(value.yields) || 1,
        selling_price: value.selling_price === "" ? undefined : Number(value.selling_price),
        prep_time_min: value.prep_time_min === "" ? undefined : Number(value.prep_time_min),
        cook_time_min: value.cook_time_min === "" ? undefined : Number(value.cook_time_min),
      };
      if (isEdit) await updateMutation.mutateAsync(payload);
      else await createMutation.mutateAsync(payload);
    },
  });

  const updateIng = (idx: number, patch: Partial<IngForm>) =>
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing)));
  const removeIng = (idx: number) => {
    if (ingredients.length === 1) return toast.error("At least one ingredient required");
    setIngredients((p) => p.filter((_, i) => i !== idx));
  };
  const addIng = () =>
    setIngredients((p) => [
      ...p,
      {
        _uid: uid(),
        material_id: "",
        qty: "",
        unit: "kg",
        wastage_percent: "",
        step_no: "",
        variant_qtys: [],
      },
    ]);
  const setVariantQty = (idx: number, variant_id: string, variant_name: string, qty: number | string) =>
    setIngredients((prev) =>
      prev.map((ing, i) => {
        if (i !== idx) return ing;
        const rest = ing.variant_qtys.filter((vq) => vq.variant_id !== variant_id);
        return { ...ing, variant_qtys: [...rest, { variant_id, variant_name, qty }] };
      }),
    );
  const autofillVariantQtys = () => {
    if (variantCols.length < 2) return;
    const [base, ...rest] = variantCols;
    setIngredients((prev) =>
      prev.map((ing) => {
        const baseQty = Number(ing.qty) || 0;
        const baseSize = Number(base.qty) || 0;
        const baseUnit = (base.unit ?? "").toLowerCase();
        const vqs = rest.map((v) => {
          const size = Number(v.qty) || 0;
          const sameUnit = (v.unit ?? "").toLowerCase() === baseUnit && baseSize > 0 && size > 0;
          const q = sameUnit
            ? Math.round(baseQty * (size / baseSize) * 1000) / 1000
            : baseQty;
          return { variant_id: v.id, variant_name: v.name, qty: q as number | string };
        });
        return {
          ...ing,
          variant_qtys: [
            { variant_id: base.id, variant_name: base.name, qty: baseQty as number | string },
            ...vqs,
          ],
        };
      }),
    );
    toast.success("Variant quantities auto-filled from base × size");
  };

  const updateStep = (idx: number, patch: Partial<StepForm>) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const removeStep = (idx: number) => setSteps((p) => p.filter((_, i) => i !== idx));
  const addStep = () =>
    setSteps((p) => [
      ...p,
      {
        _uid: uid(),
        instruction: "",
        vessel: "",
        vessel_note: "",
        temperature_c: "",
        heat_level: "",
        duration_min: "",
        image_url: "",
        is_optional: false,
      },
    ]);
  const handleStepImage = (idx: number, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error(`${file.name}: not an image`);
    if (file.size > 5 * 1024 * 1024) return toast.error(`${file.name}: max 5MB`);
    const prev = steps[idx]?.image_url;
    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
    updateStep(idx, { image_url: URL.createObjectURL(file) });
  };
  const removeStepImage = (idx: number) => {
    const prev = steps[idx]?.image_url;
    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
    updateStep(idx, { image_url: "" });
  };
  const reorderStep = (from: number, to: number) =>
    setSteps((p) => {
      const c = [...p];
      const [v] = c.splice(from, 1);
      c.splice(to, 0, v);
      return c;
    });
  const moveStep = (idx: number, dir: -1 | 1) => {
    const n = idx + dir;
    if (n < 0 || n >= steps.length) return;
    reorderStep(idx, n);
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
        {/* Card 1 - General + Presentation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
            <CardDescription>Recipe card — yield, timing, presentation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldGroup>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="name"
                  children={(field) => (
                    <field.TextField label="Recipe Name *" required placeholder="Chicken Biryani" />
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <form.AppField
                    name="yields"
                    children={(field) => (
                      <field.TextField label="Yields *" type="number" placeholder="1" />
                    )}
                  />
                  <form.AppField
                    name="yield_unit"
                    children={(field) => (
                      <field.SelectField
                        label="Yield Unit"
                        options={[
                          { label: "Serves", value: "serves" },
                          { label: "Plates", value: "plates" },
                          { label: "Kg", value: "kg" },
                          { label: "Litre", value: "l" },
                          { label: "Pcs", value: "pcs" },
                        ]}
                        placeholder="Select"
                      />
                    )}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <form.AppField
                  name="prep_time_min"
                  children={(field) => (
                    <field.TextField label="Prep (min)" type="number" placeholder="15" />
                  )}
                />
                <form.AppField
                  name="cook_time_min"
                  children={(field) => (
                    <field.TextField label="Cook (min)" type="number" placeholder="30" />
                  )}
                />
                <form.AppField
                  name="selling_price"
                  children={(field) => (
                    <field.TextField label="Selling Price" type="number" placeholder="299" />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Linked Menu Item</Label>
                  <Select
                    value={linkedMenuItemId || "__none"}
                    onValueChange={(nv) => setLinkedMenuItemId(nv === "__none" ? "" : nv)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Link dish for variant quantities…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No link (simple recipe)</SelectItem>
                      {(menuItems ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          {m.variants.length > 1 ? ` (${m.variants.length} variants)` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {variantCols.length > 0
                      ? `Variant dish — per-variant qty columns below (${variantCols.map((v) => v.name).join(" / ")})`
                      : "Simple dish — single quantity per ingredient"}
                  </p>
                </div>
                <form.AppField
                  name="is_active"
                  children={(field) => (
                    <field.SwitchField label="Active" description="Available for costing" />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <form.AppField
                  name="plating_notes"
                  children={(field) => (
                    <field.TextField label="Plating" placeholder="Layered, saffron on top" />
                  )}
                />
                <form.AppField
                  name="garnish"
                  children={(field) => (
                    <field.TextField label="Garnish" placeholder="Fried onions, mint" />
                  )}
                />
                <form.AppField
                  name="serving_vessel"
                  children={(field) => (
                    <field.TextField label="Serving Vessel" placeholder="Handi / Plate" />
                  )}
                />
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Card 2 - Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingredients *</CardTitle>
            <CardDescription>
              Raw material consumption per batch. Cost auto-calculated from avg costs. Est. batch
              cost ₹{Math.round(batchCost * 100) / 100}
              {variantCosts.length > 0 &&
                ` (${variantCosts.map((vc) => `${vc.variant_name} ₹${vc.cost}`).join(" / ")})`}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {ingredients.length} ingredient(s)
              </span>
              <div className="flex gap-2">
                {variantCols.length > 1 && (
                  <Button type="button" variant="outline" size="sm" onClick={autofillVariantQtys}>
                    Auto-fill variants
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addIng}>
                  <Icons.add className="mr-1 h-4 w-4" /> Add Ingredient
                </Button>
              </div>
            </div>
            {ingredients.map((ing, idx) => {
              const mat = matById[ing.material_id];
              const sel = materialOptions.find((o) => o.value === ing.material_id);
              const lineCost =
                (Number(ing.qty) || 0) *
                (mat?.avg_cost ?? 0) *
                (1 + (Number(ing.wastage_percent) || 0) / 100);
              return (
                <div key={ing._uid} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium">
                      #{idx + 1}
                    </span>
                    {lineCost > 0 && (
                      <span className="text-xs font-mono text-muted-foreground">
                        ₹{Math.round(lineCost * 100) / 100}
                      </span>
                    )}
                    <div className="ml-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeIng(idx)}
                        disabled={ingredients.length === 1}
                      >
                        <Icons.trash className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-12">
                    <div className="col-span-2 md:col-span-5">
                      <Field>
                        <FieldLabel>Material *</FieldLabel>
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !ing.material_id && "text-muted-foreground",
                                )}
                              />
                            }
                          >
                            <span className="truncate text-left">
                              {sel?.label ?? "Search SKU or name…"}
                            </span>
                            <Icons.chevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </PopoverTrigger>
                          <PopoverContent className="w-[--anchor-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search SKU or name..." />
                              <CommandList>
                                <CommandEmpty>No results</CommandEmpty>
                                <CommandGroup>
                                  {materialOptions.slice(0, 50).map((opt) => (
                                    <CommandItem
                                      key={opt.value}
                                      value={opt.value}
                                      keywords={[opt.label]}
                                      onSelect={(v) => updateIng(idx, { material_id: v })}
                                    >
                                      <Icons.check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          ing.material_id === opt.value
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
                      </Field>
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Qty *</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0.2"
                        value={ing.qty as any}
                        onChange={(e) =>
                          updateIng(idx, {
                            qty: e.target.value === "" ? "" : (Number(e.target.value) as any),
                          })
                        }
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <Select
                        value={ing.unit}
                        onValueChange={(nv) => updateIng(idx, { unit: nv })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Waste %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="2"
                        value={ing.wastage_percent as any}
                        onChange={(e) =>
                          updateIng(idx, {
                            wastage_percent:
                              e.target.value === "" ? "" : (Number(e.target.value) as any),
                          })
                        }
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Step</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="#"
                        value={ing.step_no as any}
                        onChange={(e) =>
                          updateIng(idx, {
                            step_no: e.target.value === "" ? "" : (Number(e.target.value) as any),
                          })
                        }
                      />
                    </div>
                  </div>
                  {variantCols.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-12">
                      {variantCols.map((v) => {
                        const o = ing.variant_qtys.find((vq) => vq.variant_id === v.id);
                        return (
                          <div key={v.id} className="col-span-1 md:col-span-3 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              {v.name} qty ({ing.unit})
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              placeholder={String(ing.qty)}
                              value={(o?.qty as any) ?? ""}
                              onChange={(e) =>
                                setVariantQty(
                                  idx,
                                  v.id,
                                  v.name,
                                  e.target.value === "" ? "" : (Number(e.target.value) as any),
                                )
                              }
                            />
                          </div>
                        );
                      })}
                      <p className="col-span-2 md:col-span-12 text-xs text-muted-foreground">
                        Blank = uses base qty {String(ing.qty)} {ing.unit}.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Card 3 - Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Method</CardTitle>
            <CardDescription>
              Step-by-step instructions — one action per step, like KDS prep cards. Drag to reorder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{steps.length}/20 steps</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStep}
                disabled={steps.length >= 20}
              >
                <Icons.add className="mr-1 h-4 w-4" /> Add Step
              </Button>
            </div>
            <SortableList
              value={steps}
              getItemValue={(s) => s._uid}
              onReorder={({ activeIndex, overIndex }) => reorderStep(activeIndex, overIndex)}
            >
              {steps.map((s, idx) => (
                <SortableItem
                  key={s._uid}
                  value={s._uid}
                  className="space-y-3 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <SortableItemHandle className="flex h-8 w-8 items-center justify-center text-muted-foreground">
                      <Icons.gripVertical className="h-4 w-4" />
                    </SortableItemHandle>
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium">
                      #{idx + 1}
                    </span>
                    {s.is_optional && (
                      <span className="rounded border px-1 py-0 text-xs text-muted-foreground">
                        Optional
                      </span>
                    )}
                    <div className="ml-auto flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveStep(idx, -1)}
                        disabled={idx === 0}
                        title="Move up"
                      >
                        <Icons.chevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveStep(idx, 1)}
                        disabled={idx === steps.length - 1}
                        title="Move down"
                      >
                        <Icons.chevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeStep(idx)}
                      >
                        <Icons.trash className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Instruction *</Label>
                      <Input
                        placeholder="Marinate chicken with spices and curd"
                        value={s.instruction}
                        onChange={(e) => updateStep(idx, { instruction: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Photo</Label>
                      {s.image_url ? (
                        <div className="relative">
                          <img
                            src={s.image_url}
                            alt={`step-${idx + 1}`}
                            className="h-16 w-16 rounded border object-cover"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeStepImage(idx)}
                            className="absolute -right-2 -top-2 h-6 w-6 rounded-full border bg-background"
                            title="Remove photo"
                          >
                            <Icons.trash className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded border border-dashed text-muted-foreground hover:bg-muted/50">
                          <Icons.upload className="h-5 w-5" />
                          <span className="text-xs">Add</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              handleStepImage(idx, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-12">
                    <div className="col-span-1 md:col-span-3 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Vessel</Label>
                      <Select
                        value={s.vessel || ""}
                        onValueChange={(nv) => updateStep(idx, { vessel: nv })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {VESSELS.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Temp °C</Label>
                      <Input
                        type="number"
                        min={0}
                        max={300}
                        placeholder="200"
                        value={s.temperature_c as any}
                        onChange={(e) =>
                          updateStep(idx, {
                            temperature_c:
                              e.target.value === "" ? "" : (Number(e.target.value) as any),
                          })
                        }
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Heat</Label>
                      <Select
                        value={s.heat_level || ""}
                        onValueChange={(nv) => updateStep(idx, { heat_level: nv })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Mins</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="25"
                        value={s.duration_min as any}
                        onChange={(e) =>
                          updateStep(idx, {
                            duration_min:
                              e.target.value === "" ? "" : (Number(e.target.value) as any),
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2 md:col-span-3 flex items-end gap-2 pb-1">
                      <Switch
                        checked={s.is_optional ?? false}
                        onCheckedChange={(nv) => updateStep(idx, { is_optional: nv })}
                      />
                      <span className="text-xs text-muted-foreground">Optional</span>
                    </div>
                  </div>
                  {s.vessel === "other" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Vessel note</Label>
                      <Input
                        placeholder="Specify vessel"
                        value={s.vessel_note ?? ""}
                        onChange={(e) => updateStep(idx, { vessel_note: e.target.value })}
                      />
                    </div>
                  )}
                </SortableItem>
              ))}
            </SortableList>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
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
