"use client";

import type { Floor } from "../api/types";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteFloor } from "../api/service";
import { floorKeys } from "../api/queries";
import { toast } from "sonner";
import Link from "next/link";
import { Show } from "@clerk/nextjs";

interface FloorListProps {
  floors: Floor[];
  onEdit?: (floor: Floor) => void;
}

export function FloorList({ floors, onEdit }: FloorListProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFloor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floorKeys.all });
      toast.success("Floor deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete floor"),
  });

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
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {floors.map((floor) => (
              <TableRow key={floor.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{floor.name}</span>
                    {floor.is_outdoor && (
                      <Badge variant="outline" className="text-xs">
                        Outdoor
                      </Badge>
                    )}
                  </div>
                  {floor.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {floor.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{floor.code}</span>
                </TableCell>
                <TableCell>
                  {floor.level === 0
                    ? "Ground"
                    : floor.level > 0
                      ? `L${floor.level}`
                      : `B${Math.abs(floor.level)}`}
                </TableCell>
                <TableCell>{floor.capacity} covers</TableCell>
                <TableCell>{floor.sort_order}</TableCell>
                <TableCell>
                  <Badge variant={floor.is_active ? "default" : "secondary"}>
                    {floor.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Show when={{ permission: "org:floors:manage" }} fallback={null}>
                      {onEdit ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(floor)}
                          aria-label={`Edit ${floor.name}`}
                        >
                          <Icons.edit className="size-4" />
                        </Button>
                      ) : (
                        <Link
                          href={`/dashboard/settings/outlet/floors/${floor.id}`}
                          aria-label={`Edit ${floor.name}`}
                        >
                          <Button variant="ghost" size="icon-sm">
                            <Icons.edit className="size-4" />
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm(`Delete floor "${floor.name}"?`))
                            deleteMutation.mutate(floor.id);
                        }}
                        disabled={deleteMutation.isPending}
                        aria-label={`Delete ${floor.name}`}
                      >
                        <Icons.trash className="size-4" />
                      </Button>
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
