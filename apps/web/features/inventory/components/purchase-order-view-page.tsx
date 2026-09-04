"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { purchaseOrderQueryOptions } from "../api/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pixa/ui/base-ui/card";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { useMutation } from "@tanstack/react-query";
import {
  sendPurchaseOrderViaEmail,
  sendPurchaseOrderViaWhatsapp,
  updatePurchaseOrderStatus,
} from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import Link from "next/link";

function statusVariant(s: string) {
  if (s === "received") return "default" as const;
  if (s === "sent") return "secondary" as const;
  if (s === "draft") return "outline" as const;
  return "destructive" as const;
}

export default function PurchaseOrderViewPage({ poId }: { poId: string }) {
  const { data: po } = useSuspenseQuery(purchaseOrderQueryOptions(poId));
  if (!po) notFound();

  const receiveMut = useMutation({
    mutationFn: () => updatePurchaseOrderStatus(po.id, "received"),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Purchase received — stock added (GRN) and avg cost updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const whatsappMut = useMutation({
    mutationFn: () => sendPurchaseOrderViaWhatsapp(po.id),
    onSuccess: (data) => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("PO sent via WhatsApp");
      window.open(data.url, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emailMut = useMutation({
    mutationFn: () => sendPurchaseOrderViaEmail(po.id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("PO sent via Email");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Purchase Order {po.po_number}</span>
            <Badge variant={statusVariant(po.status)} className="capitalize">
              {po.status}
            </Badge>
          </CardTitle>
          <CardDescription>
            Supplier: {po.supplier_name} ({po.supplier_id}) • Created{" "}
            {new Date(po.created_at).toLocaleDateString()}
            {po.expected_at && ` • Expected ${new Date(po.expected_at).toLocaleDateString()}`}
            {po.received_at && ` • GRN ${new Date(po.received_at).toLocaleDateString()}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 text-xs">
            <div>
              <b>Status:</b> {po.status}{" "}
              {po.status !== "received" ? (
                <span className="text-muted-foreground">— Not added to inventory yet</span>
              ) : (
                <span className="text-green-600">— Added to inventory (GRN)</span>
              )}
            </div>
            {po.sent_at && (
              <div>
                Sent via {po.sent_via} to {po.sent_to} on {new Date(po.sent_at).toLocaleString()}
              </div>
            )}
            {po.notes && <div>Notes: {po.notes}</div>}
            <div className="mt-1 text-muted-foreground">
              International standard: PO = Purchase Order (PO-YYYY-NNN), GRN = Goods Receipt on
              Received. Stock only increments on Received.
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell>{it.material_name ?? it.material_id}</TableCell>
                  <TableCell>{it.qty}</TableCell>
                  <TableCell>₹{it.unit_cost}</TableCell>
                  <TableCell>₹{it.qty * it.unit_cost}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-right font-bold">Total: ₹{po.total_amount}</div>

          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/dashboard/inventory/purchase-orders">
              <Button variant="outline">Back to list</Button>
            </Link>
            {po.status === "draft" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => whatsappMut.mutate()}
                  disabled={whatsappMut.isPending}
                >
                  Send via WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => emailMut.mutate()}
                  disabled={emailMut.isPending}
                >
                  Send via Email
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/api/purchase-orders/${po.id}/pdf`, "_blank")}
                >
                  View PDF
                </Button>
              </>
            )}
            {po.status === "sent" && (
              <>
                <Button variant="outline" onClick={() => whatsappMut.mutate()}>
                  Resend WhatsApp
                </Button>
                <Button variant="outline" onClick={() => emailMut.mutate()}>
                  Resend Email
                </Button>
                <Button onClick={() => receiveMut.mutate()} disabled={receiveMut.isPending}>
                  Receive (GRN) — Add to Inventory
                </Button>
              </>
            )}
            {po.status === "received" && (
              <Badge variant="default">Goods Received — Stock added</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
