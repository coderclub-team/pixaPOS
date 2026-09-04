"use client";

import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { FloorList } from "@/features/floor/components/floor-list";
import { FloorFormDialog } from "@/features/floor/components/floor-form-dialog";
import { floorsQueryOptions } from "@/features/floor/api/queries";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import type { Floor } from "@/features/floor/api/types";

export default function FloorsPage() {
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingFloor, setEditingFloor] = React.useState<Floor | null>(null);

  const { data: floors, isPending } = useQuery(floorsQueryOptions(search ? { search } : undefined));

  // Debounce search input
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  const handleCreate = () => {
    setEditingFloor(null);
    setDialogOpen(true);
  };

  const handleEdit = (floor: Floor) => {
    setEditingFloor(floor);
    setDialogOpen(true);
  };

  if (isPending) {
    return (
      <PageContainer pageTitle="Floors" pageDescription="Outlet — Floors" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Floors"
      pageDescription="Outlet — Floors. Manage serving areas: Ground, First, Rooftop, Basement. Each floor groups tables and routes orders."
      pageHeaderAction={<Button onClick={handleCreate}>Add Floor</Button>}
    >
      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder="Search floors by name or code..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <FloorList floors={floors ?? []} onEdit={handleEdit} />

      <p className="mt-4 text-xs text-muted-foreground">
        Floors organize tables and KOT routing. Sort order controls display priority. Inactive
        floors are hidden from floor selection but retained for history.
      </p>

      <FloorFormDialog open={dialogOpen} onOpenChange={setDialogOpen} floor={editingFloor} />
    </PageContainer>
  );
}
