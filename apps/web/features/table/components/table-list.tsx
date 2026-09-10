"use client";

import type { RestaurantTable } from "../api/types";
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
import { Icons } from "@pixa/ui/icons";
import { StatusDot } from "@pixa/ui/base-ui/status-dot";
import { useMutation } from "@tanstack/react-query";
import { deleteTable } from "../api/service";
import { tableKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface TableListProps {
  tables: RestaurantTable[];
}

export function TableList({ tables }: TableListProps) {
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
                <TableCell className="text-sm text-muted-foreground">
                  {table.floor_name ?? table.floor_id}
                </TableCell>
                <TableCell>{table.capacity} pax</TableCell>
                <TableCell className="capitalize">{table.shape}</TableCell>
                <TableCell>
                  {table.is_active ? (
                    <span className="text-xs capitalize text-muted-foreground">
                      {table.status.replace("_", " ")}
                    </span>
                  ) : (
                    <StatusDot isActive={false} />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <TableActions table={table} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TableActions({ table }: { table: RestaurantTable }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTable(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: tableKeys.all });
      toast.success("Table deleted");
      setDeleteOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete table"),
  });

  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {table.code}?</DialogTitle>
            <DialogDescription>
              Tables with active guests cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(table.id)}
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
              onClick={() => router.push(`/dashboard/settings/outlet/tables/${table.id}`)}
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
