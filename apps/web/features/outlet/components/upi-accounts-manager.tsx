"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Button } from "@pixa/ui/base-ui/button";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import { Icons } from "@pixa/ui/icons";
import { addUpiAccount, removeUpiAccount, setDefaultUpiAccount } from "../api/service";
import { outletKeys } from "../api/queries";
import type { Outlet } from "../api/types";
import { toast } from "sonner";

/** Multiple UPI VPAs with one manual default — the default feeds bill collect-QR. */
export default function UpiAccountsManager({ outlet }: { outlet: Outlet }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [vpa, setVpa] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: outletKeys.all });

  const addMut = useMutation({
    mutationFn: () => addUpiAccount(label, vpa),
    onSuccess: (o) => {
      refresh();
      setLabel("");
      setVpa("");
      const added = o.upi_ids[o.upi_ids.length - 1];
      toast.success(added?.is_active ? "UPI ID added and set as default" : "UPI ID added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const defaultMut = useMutation({
    mutationFn: (id: string) => setDefaultUpiAccount(id),
    onSuccess: () => {
      refresh();
      toast.success("Default UPI ID updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeUpiAccount(id),
    onSuccess: ({ promoted }) => {
      refresh();
      toast.success(promoted ? "Removed — oldest remaining set as default" : "UPI ID removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">UPI IDs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {outlet.upi_ids.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No UPI IDs yet. Add the counter VPA — bills print a collect-QR while a balance is due.
          </p>
        ) : (
          <div className="space-y-2.5">
            {outlet.upi_ids.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{u.label}</span>
                    {u.is_active && <Badge variant="outline">Default</Badge>}
                  </div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{u.vpa}</div>
                </div>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md p-0 hover:bg-muted">
                    <Icons.ellipsis className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuGroup>
                      {!u.is_active && (
                        <DropdownMenuItem onClick={() => defaultMut.mutate(u.id)}>
                          <Icons.check className="size-4" /> Set default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => removeMut.mutate(u.id)}>
                        <Icons.trash className="size-4" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-2 rounded-xl border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="upi-label">Label</Label>
              <Input
                id="upi-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Counter"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="upi-vpa">UPI ID</Label>
              <Input
                id="upi-vpa"
                value={vpa}
                onChange={(e) => setVpa(e.target.value)}
                placeholder="outlet@okhdfc"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={!label.trim() || !vpa.trim() || addMut.isPending}
              onClick={() => addMut.mutate()}
            >
              {addMut.isPending ? "Adding…" : "Add UPI ID"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
