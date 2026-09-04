"use client";

import type { RestaurantTable } from "../api/types";
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
import { deleteTable } from "../api/service";
import { tableKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import Link from "next/link";
import { Protect } from "@clerk/nextjs";

interface TableListProps {
  tables: RestaurantTable[];
}

function statusVariant(status: RestaurantTable["status"]) {
  switch (status) {
    case "available":
      return "default" as const;
    case "occupied":
      return "destructive" as const;
    case "reserved":
      return "secondary" as const;
    case "maintenance":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export function TableList({ tables }: TableListProps) {
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTable(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: tableKeys.all });
      toast.success("Table deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete table"),
  });

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.table className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No tables yet</p>
            <p className="text-sm text-muted-foreground">
              Create tables per floor — e.g., T1 (4 covers) on Ground Floor, T2 (2 covers) on
              Rooftop.
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
              <TableHead>Table</TableHead>
              <TableHead>Floor</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Shape</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.map((table) => (
              <TableRow key={table.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{table.number}</span>
                    <span className="font-mono text-xs text-muted-foreground">{table.code}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{table.floor_name ?? table.floor_id}</Badge>
                </TableCell>
                <TableCell>{table.capacity} pax</TableCell>
                <TableCell className="capitalize">{table.shape}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(table.status)} className="capitalize">
                    {table.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={table.is_active ? "default" : "secondary"}>
                    {table.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Protect permission="org:tables:manage" fallback={null}>
                      <Link
                        href={`/dashboard/settings/outlet/tables/${table.id}`}
                        aria-label={`Edit ${table.code}`}
                      >
                        <Button variant="ghost" size="icon-sm">
                          <Icons.edit className="size-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm(`Delete table "${table.code}"?`))
                            deleteMutation.mutate(table.id);
                        }}
                        disabled={deleteMutation.isPending}
                        aria-label={`Delete ${table.code}`}
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
