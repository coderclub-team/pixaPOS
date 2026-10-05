"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Switch } from "@pixa/ui/base-ui/switch";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { menuKeys, modifiersQueryOptions } from "../api/queries";
import { createModifier, deleteModifier, moveModifier, updateModifier } from "../api/service";
import { toast } from "sonner";

/**
 * Inline add-on options manager: add row + per-row edit (name, KOT alias,
 * price), arrows reorder, active toggle, delete. Alias prints on KOTs
 * instead of the name when set (Peblla pattern).
 */
export default function ModifierOptionsManager({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const { data: options } = useQuery(modifiersQueryOptions(groupId));
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAlias, setEditAlias] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: menuKeys.all });

  const addMut = useMutation({
    mutationFn: () =>
      createModifier({
        modifier_group_id: groupId,
        name: name.trim(),
        alias: alias.trim() || undefined,
        price: Number(price) || 0,
      }),
    onSuccess: () => {
      invalidate();
      setName("");
      setAlias("");
      setPrice("");
      toast.success("Add-on added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) =>
      updateModifier(id, {
        name: editName.trim(),
        alias: editAlias.trim() || undefined,
        price: Number(editPrice) || 0,
      }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast.success("Add-on updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateModifier(id, { is_active: active }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
  const moveMut = useMutation({
    mutationFn: ({ id, dir }: { id: string; dir: -1 | 1 }) => moveModifier(id, dir),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteModifier(id),
    onSuccess: () => {
      invalidate();
      toast.success("Add-on deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">
          Options · {(options ?? []).length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] items-end gap-2 md:grid-cols-[1fr_1fr_8rem_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="mod-name" className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input
              id="mod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Extra cheese"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mod-alias" className="text-xs text-muted-foreground">
              KOT alias (optional)
            </Label>
            <Input
              id="mod-alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="X-CHZ"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mod-price" className="text-xs text-muted-foreground">
              Price (₹)
            </Label>
            <Input
              id="mod-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              autoComplete="off"
            />
          </div>
          <Button
            disabled={addMut.isPending || name.trim().length < 2}
            onClick={() => addMut.mutate()}
            className="min-h-11"
          >
            <Icons.add className="mr-1 size-4" /> Add
          </Button>
        </div>

        <div className="space-y-1.5">
          {(options ?? []).map((m, i, arr) => (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-2 py-1.5",
                !m.is_active && "opacity-60",
              )}
            >
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6"
                  disabled={i === 0}
                  onClick={() => moveMut.mutate({ id: m.id, dir: -1 })}
                  aria-label={`Move ${m.name} up`}
                >
                  <Icons.chevronUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6"
                  disabled={i === arr.length - 1}
                  onClick={() => moveMut.mutate({ id: m.id, dir: 1 })}
                  aria-label={`Move ${m.name} down`}
                >
                  <Icons.chevronDown className="size-3.5" />
                </Button>
              </div>
              {editingId === m.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 min-w-0 flex-1"
                    aria-label="Add-on name"
                  />
                  <Input
                    value={editAlias}
                    onChange={(e) => setEditAlias(e.target.value)}
                    placeholder="Alias"
                    className="h-9 w-24 shrink-0"
                    aria-label="KOT alias"
                  />
                  <Input
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="₹"
                    className="h-9 w-20 shrink-0"
                    aria-label="Price"
                  />
                  <Button
                    size="sm"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate(m.id)}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                    title="Tap to edit"
                    onClick={() => {
                      setEditingId(m.id);
                      setEditName(m.name);
                      setEditAlias(m.alias ?? "");
                      setEditPrice(String(m.price ?? 0));
                    }}
                  >
                    {m.name}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
                      {m.alias ? `${m.alias} · ` : ""}₹{m.price ?? 0}
                    </span>
                  </button>
                  <Switch
                    checked={m.is_active}
                    onCheckedChange={(v) => toggleMut.mutate({ id: m.id, active: v })}
                    aria-label={`${m.name} active`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => delMut.mutate(m.id)}
                    aria-label={`Delete ${m.name}`}
                  >
                    <Icons.trash className="size-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {(options ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No add-ons yet — add the first one above.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
