"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
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
import { toast } from "sonner";
import { promoKeys } from "../api/queries";
import { createPromo, updatePromo } from "../api/service";
import type { OrderChannel } from "@/features/orders/api/types";
import type { PromoCode, PromoKind, PromoScope } from "../api/types";
import { menuItemsQueryOptions, menuCategoriesQueryOptions } from "@/features/menu/api/queries";
import { kotOrderTypeOptions } from "@/features/orders/components/order-type";

const CHANNELS = kotOrderTypeOptions.map((o) => o.value as OrderChannel);

export default function PromoForm({ initialData }: { initialData?: PromoCode }) {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  // Prefill from Item Sales "New promo" (scope/target preset, rest editable).
  const [code, setCode] = useState(initialData?.code ?? "");
  const [name, setName] = useState(initialData?.name ?? "");
  const [kind, setKind] = useState<PromoKind>(initialData?.kind ?? "percent");
  const [value, setValue] = useState(initialData ? String(initialData.value) : "10");
  const [scope, setScope] = useState<PromoScope>(
    initialData?.scope ?? (search.get("scope") as PromoScope) ?? "order",
  );
  const [targets, setTargets] = useState<string[]>(() => {
    if (initialData) return initialData.target_ids;
    const t = search.get("target");
    return t ? [t] : [];
  });
  const [channels, setChannels] = useState<OrderChannel[]>(initialData?.channels ?? []);
  const [minOrder, setMinOrder] = useState(
    initialData?.min_order_paise != null ? String(initialData.min_order_paise / 100) : "",
  );
  const [startsAt, setStartsAt] = useState(initialData?.starts_at?.slice(0, 10) ?? "");
  const [endsAt, setEndsAt] = useState(initialData?.ends_at?.slice(0, 10) ?? "");
  const [usageLimit, setUsageLimit] = useState(
    initialData?.usage_limit != null ? String(initialData.usage_limit) : "",
  );
  const [perCustomer, setPerCustomer] = useState(
    initialData?.per_customer_limit != null ? String(initialData.per_customer_limit) : "",
  );
  const [active, setActive] = useState(initialData?.is_active ?? true);

  const { data: items } = useQuery(menuItemsQueryOptions({}));
  const { data: categories } = useQuery(menuCategoriesQueryOptions());

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        code,
        name: name.trim() || undefined,
        kind,
        // Flat is entered in ₹ (bill total or per unit) — stored as paise.
        value: kind === "flat" ? Math.round(Number(value) * 100) : Number(value),
        scope,
        target_ids: scope === "order" ? [] : targets,
        channels,
        min_order_paise: minOrder.trim() === "" ? undefined : Math.round(Number(minOrder) * 100),
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined,
        usage_limit: usageLimit.trim() === "" ? undefined : Number(usageLimit),
        per_customer_limit: perCustomer.trim() === "" ? undefined : Number(perCustomer),
        is_active: active,
      };
      return isEdit ? updatePromo(initialData!.id, payload) : createPromo(payload as any);
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: promoKeys.all });
      toast.success(isEdit ? "Promo updated" : `Promo ${p.code} created`);
      router.push("/dashboard/marketing/promos");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">
          {isEdit ? `Edit ${initialData.code}` : "New promo code"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Code *</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DIWALI10"
              autoComplete="off"
              disabled={isEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Diwali 10% off"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex gap-2">
              {(["percent", "flat"] as PromoKind[]).map((k) => (
                <Button
                  key={k}
                  type="button"
                  variant={kind === k ? "default" : "outline"}
                  size="sm"
                  onClick={() => setKind(k)}
                >
                  {k === "percent" ? "Percent %" : "Flat ₹"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>
              {kind === "percent" ? "Percent (1–100)" : "Amount ₹ (bill) / ₹ per unit (items)"}
            </Label>
            <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Applies to</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as PromoScope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="order">Whole bill</SelectItem>
              <SelectItem value="item">Specific items</SelectItem>
              <SelectItem value="category">Whole categories</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {scope === "item" && (
          <div className="space-y-1.5">
            <Label>Items ({targets.length} selected)</Label>
            <div className="max-h-44 overflow-auto rounded-lg border p-2">
              {(items ?? [])
                .filter((m) => m.is_active)
                .map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={targets.includes(m.id)}
                      onChange={() => toggle(targets, m.id, setTargets)}
                    />
                    {m.name}
                  </label>
                ))}
            </div>
          </div>
        )}
        {scope === "category" && (
          <div className="space-y-1.5">
            <Label>Categories ({targets.length} selected)</Label>
            <div className="max-h-44 overflow-auto rounded-lg border p-2">
              {(categories ?? [])
                .filter((c) => c.is_active)
                .map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={targets.includes(c.id)}
                      onChange={() => toggle(targets, c.id, setTargets)}
                    />
                    {c.name}
                  </label>
                ))}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Channels (empty = all)</Label>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <Button
                key={c}
                type="button"
                variant={channels.includes(c) ? "default" : "outline"}
                size="sm"
                onClick={() => toggle(channels, c, setChannels)}
              >
                {c.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Min bill ₹ (optional)</Label>
            <Input
              type="number"
              min={0}
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              placeholder="299"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Total usage limit (optional)</Label>
            <Input
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="500"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Valid from (optional)</Label>
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valid till (optional)</Label>
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Per-customer limit (optional)</Label>
            <Input
              type="number"
              min={1}
              value={perCustomer}
              onChange={(e) => setPerCustomer(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-6">
            <Label>Active</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/marketing/promos")}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save promo" : "Create promo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
