"use client";
import { useState } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Field, FieldGroup, FieldLabel } from "@pixa/ui/base-ui/field";
import { Label } from "@pixa/ui/base-ui/label";
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
import { wasteSchema, type WasteValues } from "../schemas/waste";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createWasteLog } from "../api/service";
import { inventoryKeys, rawMaterialsQueryOptions } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";

const reasonOptions = [
  { label: "Spoilage", value: "spoilage" },
  { label: "Expired", value: "expired" },
  { label: "Overproduction", value: "overproduction" },
  { label: "Trimming", value: "trimming" },
  { label: "Spillage", value: "spillage" },
  { label: "Order cancelled", value: "order_cancelled" },
  { label: "Other", value: "other" },
];

export default function WasteForm({ pageTitle }: { pageTitle: string }) {
  const router = useRouter();
  const { data: materials } = useQuery(rawMaterialsQueryOptions());
  const materialOptions = (materials ?? []).map((m) => ({
    label: `${m.name} (${m.sku}) — ₹${m.avg_cost}/${m.unit} • Stock ${m.stock_qty}`,
    value: m.id,
  }));
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const mutation = useMutation({
    mutationFn: (v: WasteValues & { photo_url?: string }) => createWasteLog(v as any),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Waste logged");
      router.push("/dashboard/inventory/waste");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const form = useAppForm({
    defaultValues: { material_id: "", qty: 1, reason: "spoilage", notes: "" } as WasteValues,
    validators: { onSubmit: wasteSchema },
    onSubmit: async ({ value }) =>
      mutation.mutateAsync({ ...value, photo_url: photoUrl || undefined }),
  });
  const handlePhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error(`${file.name}: not an image`);
    if (file.size > 5 * 1024 * 1024) return toast.error(`${file.name}: max 5MB`);
    if (photoUrl.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
  };
  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
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
              name="material_id"
              children={(field) => {
                const value = field.state.value as string;
                const sel = materialOptions.find((o) => o.value === value);
                const mat = (materials ?? []).find((m) => m.id === value);
                return (
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
                              !value && "text-muted-foreground",
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
                    {mat && (
                      <p className="text-xs text-muted-foreground">
                        Unit {mat.unit} • Stock {mat.stock_qty} • Avg ₹{mat.avg_cost}
                      </p>
                    )}
                  </Field>
                );
              }}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <form.AppField
                name="qty"
                children={(field) => {
                  const qty = Number(field.state.value) || 0;
                  const mid = form.getFieldValue("material_id" as any) as string;
                  const mat = (materials ?? []).find((m) => m.id === mid);
                  const est = mat ? Math.round(qty * mat.avg_cost * 100) / 100 : 0;
                  return (
                    <div className="space-y-1.5">
                      <field.TextField
                        label={`Quantity${mat ? ` (${mat.unit})` : ""} *`}
                        required
                        type="number"
                        placeholder="2"
                      />
                      {mat && qty > 0 && (
                        <p className="text-xs text-muted-foreground">Est. loss ₹{est}</p>
                      )}
                    </div>
                  );
                }}
              />
              <form.AppField
                name="reason"
                children={(field) => (
                  <field.SelectField
                    label="Reason"
                    required
                    options={reasonOptions}
                    placeholder="Select reason"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Photo (optional)</Label>
              {photoUrl ? (
                <div className="relative w-fit">
                  <img
                    src={photoUrl}
                    alt="waste evidence"
                    className="h-24 w-24 rounded border object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (photoUrl.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
                      setPhotoUrl("");
                    }}
                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full border bg-background"
                    title="Remove photo"
                  >
                    <Icons.trash className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded border border-dashed text-muted-foreground hover:bg-muted/50">
                  <Icons.upload className="h-5 w-5" />
                  <span className="text-xs">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handlePhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <form.AppField
              name="notes"
              children={(field) => (
                <field.TextareaField label="Notes" placeholder="Overripe tomatoes" rows={2} />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <form.AppForm children={<form.SubmitButton>Log Waste</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
