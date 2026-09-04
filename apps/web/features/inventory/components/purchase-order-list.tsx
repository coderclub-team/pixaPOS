"use client";
import type { PurchaseOrder } from "../api/types";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  sendPurchaseOrderViaEmail,
  sendPurchaseOrderViaWhatsapp,
  updatePurchaseOrderStatus,
} from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { Show } from "@clerk/nextjs";
import Link from "next/link";

function statusVariant(s: string) {
  if (s === "received") return "default" as const;
  if (s === "sent") return "secondary" as const;
  if (s === "draft") return "outline" as const;
  return "destructive" as const;
}

export function PurchaseOrderList({ orders }: { orders: PurchaseOrder[] }) {
  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) =>
      updatePurchaseOrderStatus(id, status),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("PO status updated — stock added only on Received (GRN)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const whatsappMut = useMutation({
    mutationFn: (id: string) => sendPurchaseOrderViaWhatsapp(id),
    onSuccess: (data) => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("PO sent via WhatsApp");
      window.open(data.url, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const emailMut = useMutation({
    mutationFn: (id: string) => sendPurchaseOrderViaEmail(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("PO sent via Email");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (orders.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No purchase orders — create PO to replenish raw materials.
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/dashboard/inventory/purchase-orders/${po.id}`}
                    className="underline"
                  >
                    {po.po_number}
                  </Link>
                  {po.status === "received" && po.received_at && (
                    <div className="text-[10px] text-muted-foreground">
                      GRN {new Date(po.received_at).toLocaleDateString()}
                    </div>
                  )}
                  {po.sent_at && (
                    <div className="text-[10px] text-muted-foreground">
                      Sent {po.sent_via} {new Date(po.sent_at).toLocaleDateString()}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div>{po.supplier_name}</div>
                  {po.expected_at && (
                    <div className="text-[10px] text-muted-foreground">
                      Exp {new Date(po.expected_at).toLocaleDateString()}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {po.items.map((it) => `${it.material_name} x${it.qty}`).join(", ")}
                </TableCell>
                <TableCell>₹{po.total_amount}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(po.status)} className="capitalize">
                    {po.status}
                  </Badge>
                  {po.status !== "received" && (
                    <div className="text-[10px] text-muted-foreground">Not in stock</div>
                  )}
                  {po.status === "received" && (
                    <div className="text-[10px] text-green-600">In stock (GRN)</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Show when={{ permission: "org:purchases:manage" }} fallback={null}>
                      <Link href={`/dashboard/inventory/purchase-orders/${po.id}`}>
                        <Button variant="ghost" size="icon-sm">
                          <Icons.eyeOff className="size-4" />
                        </Button>
                      </Link>
                      {po.status === "draft" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => whatsappMut.mutate(po.id)}
                            disabled={whatsappMut.isPending}
                          >
                            WhatsApp
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => emailMut.mutate(po.id)}
                            disabled={emailMut.isPending}
                          >
                            Email
                          </Button>
                        </>
                      )}
                      {po.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => mut.mutate({ id: po.id, status: "sent" })}
                        >
                          Mark Sent
                        </Button>
                      )}
                      {po.status === "sent" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => whatsappMut.mutate(po.id)}
                          >
                            WhatsApp
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => emailMut.mutate(po.id)}>
                            Email
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => mut.mutate({ id: po.id, status: "received" })}
                          >
                            Receive (GRN)
                          </Button>
                        </>
                      )}
                    </Show>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
