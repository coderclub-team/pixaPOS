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
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { updatePurchaseOrderStatus } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { Protect } from "@clerk/nextjs";

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
      toast.success("PO status updated — stock adjusted if received");
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
                <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                <TableCell>{po.supplier_name}</TableCell>
                <TableCell className="text-xs">
                  {po.items.map((it) => `${it.material_name} x${it.qty}`).join(", ")}
                </TableCell>
                <TableCell>₹{po.total_amount}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(po.status)} className="capitalize">
                    {po.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Protect permission="org:purchases:manage" fallback={null}>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => mut.mutate({ id: po.id, status: "received" })}
                        >
                          Receive
                        </Button>
                      )}
                    </Protect>
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
