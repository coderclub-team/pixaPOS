"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { menuCategoriesQueryOptions } from "@/features/menu/api/queries";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createMenuCategory, deleteMenuCategory } from "@/features/menu/api/service";
import { menuKeys } from "@/features/menu/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { toast } from "sonner";

export default function CategoriesPage() {
  const { data: cats, isPending } = useQuery(menuCategoriesQueryOptions());
  const [name, setName] = React.useState("");
  const createMut = useMutation({
    mutationFn: () => createMenuCategory({ name }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: menuKeys.all });
      toast.success("Category created");
      setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteMenuCategory(id),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: menuKeys.all });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isPending)
    return (
      <PageContainer pageTitle="Menu Categories" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Menu Categories"
      pageDescription="Menu categories — Starters, Biryani etc. Separate from RawMaterial category."
    >
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !name}>
          Add
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cats ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => delMut.mutate(c.id)}>
                      <Icons.trash className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
