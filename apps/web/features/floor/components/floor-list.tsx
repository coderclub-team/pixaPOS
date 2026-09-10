"use client";

import type { Floor } from "../api/types";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteFloor } from "../api/service";
import { floorKeys } from "../api/queries";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface FloorListProps {
  floors: Floor[];
  onEdit?: (floor: Floor) => void;
}

export function FloorList({ floors, onEdit }: FloorListProps) {
  const queryClient = useQueryClient();

  if (floors.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.layers className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No floors yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first floor — e.g., Ground Floor, Rooftop, Basement.
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
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Sort</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {floors.map((floor) => (
              <FloorRow key={floor.id} floor={floor} onEdit={onEdit} queryClient={queryClient} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FloorRow({
  floor,
  onEdit,
  queryClient,
}: {
  floor: Floor;
  onEdit?: (floor: Floor) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFloor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floorKeys.all });
      toast.success("Floor deleted");
      setDeleteOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete floor"),
  });

  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {floor.name}?</DialogTitle>
            <DialogDescription>
              Floors with tables or active occupancy cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(floor.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TableRow>
        <TableCell>
          <div className="font-medium">
            {floor.name}
            {!floor.is_active && <span className="text-xs text-muted-foreground"> • Inactive</span>}
          </div>
          {floor.description && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{floor.description}</p>
          )}
          {floor.is_outdoor && <span className="text-xs text-muted-foreground">Outdoor</span>}
        </TableCell>
        <TableCell className="font-mono text-xs">{floor.code}</TableCell>
        <TableCell>
          {floor.level === 0 ? "Ground" : floor.level > 0 ? `L${floor.level}` : `B${Math.abs(floor.level)}`}
        </TableCell>
        <TableCell>{floor.capacity} covers</TableCell>
        <TableCell>{floor.sort_order}</TableCell>
        <TableCell className="text-right">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
              <Icons.ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuGroup>
                {onEdit ? (
                  <DropdownMenuItem onClick={() => onEdit(floor)}>
                    <Icons.edit className="mr-2 h-4 w-4" /> Update
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => router.push(`/dashboard/settings/outlet/floors/${floor.id}`)}
                  >
                    <Icons.edit className="mr-2 h-4 w-4" /> Update
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                  <Icons.trash className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </>
  );
}
