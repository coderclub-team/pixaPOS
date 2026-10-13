"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Icons } from "@pixa/ui/icons";
import { toast } from "sonner";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { ScrollArea } from "@pixa/ui/base-ui/scroll-area";
import { Separator } from "@pixa/ui/base-ui/separator";
import { outletsQueryOptions } from "@/features/outlet/api/queries";
import { bulkShare, SHAREABLE_ENTITIES, type ShareableEntity } from "../api/availability";
import { getQueryClient } from "@/lib/query-client";

const INVALIDATE_BY_ENTITY: Record<ShareableEntity, string[][]> = {
  category: [["menu"]],
  menu_item: [["menu"]],
  raw_material: [["inventory"]],
  recipe: [["inventory"]],
  supplier: [["inventory"]],
  modifier_group: [["menu"]],
  promo: [["promos"]],
};

/**
 * Bulk share (or unshare) org masters with target outlets. Masters stay
 * shared — sharing writes per-outlet availability (price overrides for menu
 * items); promos are copied per outlet. Idempotent and retry-safe.
 */
export function BulkShareDialog({
  open,
  onClose,
  entity,
  items,
}: {
  open: boolean;
  onClose: () => void;
  entity: ShareableEntity;
  items: { id: string; name: string }[];
}) {
  const { data: outlets } = useQuery(outletsQueryOptions);
  const [targets, setTargets] = useState<string[]>([]);
  const [mode, setMode] = useState<"share" | "unshare">("share");
  const [price, setPrice] = useState("");
  const label = SHAREABLE_ENTITIES.find((e) => e.value === entity)?.label ?? entity;
  const list = (outlets ?? []).filter((o) => o.is_active);

  const toggleTarget = (id: string) =>
    setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const applyMut = useMutation({
    mutationFn: () =>
      bulkShare({
        outletIds: targets,
        entity,
        entityIds: items.map((i) => i.id),
        is_available: mode === "share",
        price_override:
          entity === "menu_item" && price.trim() !== ""
            ? Math.round(Number(price) * 100)
            : undefined,
      }),
    onSuccess: (r) => {
      const qc = getQueryClient();
      for (const key of INVALIDATE_BY_ENTITY[entity]) qc.invalidateQueries({ queryKey: key });
      toast.success(
        `${label}: ${r.applied} applied, ${r.skipped} skipped${r.failed > 0 ? `, ${r.failed} failed` : ""}`,
      );
      setTargets([]);
      setPrice("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Share {label} ({items.length})
          </DialogTitle>
          <DialogDescription>
            {mode === "share"
              ? "Make these available in the selected outlets."
              : "Hide these from the selected outlets (master data is kept)."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {(["share", "unshare"] as const).map((m) => (
            <Button
              key={m}
              type="button"
              variant={mode === m ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(m)}
              className="capitalize"
            >
              {m}
            </Button>
          ))}
        </div>
        {entity === "menu_item" && mode === "share" && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Outlet price ₹ (optional — overrides all variants)
            </Label>
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Leave empty to keep master price"
            />
          </div>
        )}
        <Separator />
        <Label className="text-xs text-muted-foreground">Target outlets</Label>
        <ScrollArea className="max-h-[240px]">
          {list.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">No outlets yet</p>
          ) : (
            <div className="flex flex-col gap-1">
              {list.map((o) => (
                <label
                  key={o.id}
                  className="hover:bg-muted/60 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={targets.includes(o.id)}
                    onChange={() => toggleTarget(o.id)}
                  />
                  <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                    {o.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={applyMut.isPending || targets.length === 0 || items.length === 0}
            onClick={() => applyMut.mutate()}
          >
            {applyMut.isPending
              ? "Applying…"
              : `Apply to ${targets.length} outlet${targets.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One-line entry point for list toolbars: a Share button + dialog for the
 * currently loaded rows. `items` should be the visible (filtered) rows.
 */
export function BulkShareButton({
  entity,
  items,
}: {
  entity: ShareableEntity;
  items: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={items.length === 0}
      >
        <Icons.share className="mr-1 size-4" />
        Share
      </Button>
      {open && (
        <BulkShareDialog open={open} onClose={() => setOpen(false)} entity={entity} items={items} />
      )}
    </>
  );
}
