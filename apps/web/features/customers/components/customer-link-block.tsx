"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { orderKeys, orderQueryOptions } from "@/features/orders/api/queries";
import { linkCustomer } from "@/features/orders/api/service";
import {
  createCustomer,
  findCustomerByPhone,
} from "@/features/customers/api/service";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";

/**
 * Shared customer lookup + quick-create block for order surfaces
 * (workspace summary, terminal bill panel). Phone lookup links an existing
 * record; otherwise an inline name+phone form creates and links in one tap.
 */
export default function CustomerLinkBlock({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const [phone, setPhone] = useState("");
  const [looking, setLooking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const invalidate = () => {
    getQueryClient().invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    getQueryClient().invalidateQueries({ queryKey: orderKeys.all });
  };

  const linkMut = useMutation({
    mutationFn: (customerId: string) => linkCustomer(orderId, customerId),
    onSuccess: (o) => {
      invalidate();
      toast.success(`Linked ${o.customer_name}`);
      setPhone("");
      setName("");
      setLooking(false);
      setCreating(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createCustomer({
        outlet_id: order?.outlet_id ?? "out_001",
        name: name.trim(),
        phone: phone.trim(),
      } as never),
    onSuccess: (c) => linkMut.mutate(c.id),
    onError: (e: Error) => toast.error(e.message),
  });

  const lookup = async () => {
    if (!phone.trim()) return;
    setLooking(true);
    try {
      const found = await findCustomerByPhone(phone.trim(), order?.outlet_id ?? "out_001");
      if (found) {
        linkMut.mutate(found.id);
      } else {
        // No record — expand the quick-create form with the phone prefilled.
        setCreating(true);
        setLooking(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
      setLooking(false);
    }
  };

  if (!order) return null;

  if (order.customer_id) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Customer</span>
        <Link
          href={`/dashboard/customers/${order.customer_id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {order.customer_name}
          {order.customer_phone ? ` · ${order.customer_phone}` : ""}
        </Link>
      </div>
    );
  }

  if (order.customer_name || order.customer_phone) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Customer</span>
        <span className="text-xs">
          {order.customer_name}
          {order.customer_phone ? ` · ${order.customer_phone}` : ""} (unlinked)
        </span>
      </div>
    );
  }

  const terminal = order.status === "COMPLETED" || order.status === "CANCELLED";
  if (terminal) return null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Customer</Label>
      <div className="flex gap-1.5">
        <Input
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" disabled={looking || linkMut.isPending || !phone.trim()} onClick={lookup}>
          {looking ? "…" : "Link"}
        </Button>
      </div>
      {creating && (
        <div className="space-y-1.5 rounded-lg border border-dashed p-2">
          <p className="text-[11px] text-muted-foreground">
            No record for {phone.trim()} — create and link:
          </p>
          <Input
            placeholder="Customer name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={createMut.isPending || linkMut.isPending || !name.trim() || !phone.trim()}
              onClick={() => createMut.mutate()}
            >
              Create & link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
