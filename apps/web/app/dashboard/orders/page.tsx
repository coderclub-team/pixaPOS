"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { formatINR } from "@/lib/money";
import { orderKeys, ordersQueryOptions } from "@/features/orders/api/queries";
import { deleteOrder } from "@/features/orders/api/service";
import type { OrderChannel, OrderStatus, OrderWithDerived } from "@/features/orders/api/types";
import OrderStatusText from "@/features/orders/components/order-status";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";

const CHANNELS: { value: OrderChannel | "all"; label: string }[] = [
  { value: "all", label: "All channels" },
  { value: "dine_in", label: "Dine-in" },
  { value: "takeaway", label: "Takeaway" },
  { value: "delivery", label: "Delivery" },
  { value: "zomato", label: "Zomato" },
  { value: "swiggy", label: "Swiggy" },
  { value: "own_online", label: "Online" },
];

const STATUSES: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_KITCHEN", label: "In kitchen" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready" },
  { value: "SERVED", label: "Served" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [channel, setChannel] = useState<OrderChannel | "all">("all");
  const [status, setStatus] = useState<OrderStatus | "all">("all");

  const { data: orders, isPending } = useQuery(
    ordersQueryOptions({
      search: search || undefined,
      channel: channel === "all" ? undefined : channel,
      status: status === "all" ? undefined : status,
    }),
  );

  if (isPending) {
    return (
      <PageContainer pageTitle="Orders" pageDescription="Sales — Orders" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Orders"
      pageDescription="Orders across dine-in, takeaway, delivery and online channels. Create them from the Order Terminal."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by number, customer, phone…"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              window.clearTimeout((window as any).__orderSearchT);
              (window as any).__orderSearchT = window.setTimeout(() => setSearch(e.target.value), 300);
            }}
            className="pl-8"
          />
        </div>
        <Select value={channel} onValueChange={(v) => setChannel(v as OrderChannel | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!orders?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
              <div className="rounded-full border border-dashed p-3">
                <Icons.orders className="size-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No orders yet</p>
              <p className="text-sm text-muted-foreground">
                Create orders from the Order Terminal by tapping a table.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Table / Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>KOTs</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <span className="font-medium">{o.order_number}</span>
                      {o.external_ref && (
                        <div className="font-mono text-[10px] text-muted-foreground">{o.external_ref}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {o.channel.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.table_number_snapshot ? (
                        <span>
                          Table {o.table_number_snapshot}
                          {o.occupancy_group_id && (
                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                              · seated
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {o.customer_name ?? o.customer_phone ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.items.length} item{o.items.length === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell className="text-sm">{o.kot_count}</TableCell>
                    <TableCell className="font-medium">{formatINR(o.total_paise)}</TableCell>
                    <TableCell>
                      <OrderStatusText status={o.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <OrderActions order={o} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

function OrderActions({ order }: { order: OrderWithDerived }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: orderKeys.all });
      toast.success("Order deleted");
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {order.order_number}?</DialogTitle>
            <DialogDescription>
              Only orders with no fired items can be deleted. Fired orders must be cancelled instead.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate(order.id)}
              disabled={deleteMut.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
          <Icons.ellipsis className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/dashboard/orders/${order.id}`)}>
              <Icons.edit className="mr-2 h-4 w-4" /> Update
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
              <Icons.trash className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
