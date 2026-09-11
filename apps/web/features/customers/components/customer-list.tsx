"use client";

import type { CustomerWithDerived } from "../api/types";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Icons } from "@pixa/ui/icons";
import { StatusDot } from "@pixa/ui/base-ui/status-dot";
import { useMutation } from "@tanstack/react-query";
import { deleteCustomer } from "../api/service";
import { customerKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface CustomerListProps {
  customers: CustomerWithDerived[];
}

export function CustomerList({ customers }: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.customers className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No customers yet</p>
            <p className="text-sm text-muted-foreground">
              Add walk-in, delivery and online customers with addresses for future website orders.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  {c.email && (
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.primary_address?.city ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{c.orders_count}</TableCell>
                <TableCell>
                  <StatusDot isActive={c.is_active} />
                </TableCell>
                <TableCell className="text-right">
                  <CustomerActions customer={c} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CustomerActions({ customer }: { customer: CustomerWithDerived }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: customerKeys.all });
      toast.success("Customer deleted");
      setDeleteOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete customer"),
  });

  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {customer.name}?</DialogTitle>
            <DialogDescription>
              The record is soft-deleted and stays out of new orders. History keeps referencing it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(customer.id)}
              disabled={deleteMutation.isPending}
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
            <DropdownMenuItem
              onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
            >
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
