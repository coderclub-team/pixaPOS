"use client";
import type { Supplier } from "../api/types";
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
import { useMutation } from "@tanstack/react-query";
import { deleteSupplier } from "../api/service";
import { inventoryKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import Link from "next/link";
import { Protect } from "@clerk/nextjs";

export function SupplierList({ suppliers }: { suppliers: Supplier[] }) {
  const del = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Supplier deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (suppliers.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No suppliers — add your first vendor.
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.contact_person ?? s.email ?? "-"}
                  </div>
                </TableCell>
                <TableCell>{s.phone}</TableCell>
                <TableCell className="font-mono text-xs">{s.gstin ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? "default" : "secondary"}>
                    {s.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Protect permission="org:suppliers:manage" fallback={null}>
                      <Link href={`/dashboard/inventory/suppliers/${s.id}`}>
                        <Button variant="ghost" size="icon-sm">
                          <Icons.edit className="size-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => confirm(`Delete ${s.name}?`) && del.mutate(s.id)}
                      >
                        <Icons.trash className="size-4" />
                      </Button>
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
