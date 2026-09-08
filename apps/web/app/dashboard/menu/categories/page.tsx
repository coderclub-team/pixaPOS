"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { menuCategoriesQueryOptions } from "@/features/menu/api/queries";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  createMenuCategory,
  deleteMenuCategory,
  updateMenuCategory,
} from "@/features/menu/api/service";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import { Switch } from "@pixa/ui/base-ui/switch";
import { Icons } from "@pixa/ui/icons";
import { toast } from "sonner";
import { Label } from "@pixa/ui/base-ui/label";
import Link from "next/link";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { cn } from "@pixa/ui/lib/utils";

export default function CategoriesPage() {
  const [search, setSearch] = React.useState("");
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: cats, isPending } = useQuery(
    menuCategoriesQueryOptions({ search: search || undefined }),
  );
  const [name, setName] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editActive, setEditActive] = React.useState(true);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
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
  const updateMut = useMutation({
    mutationFn: () => updateMenuCategory(editId!, { name: editName, is_active: editActive }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: menuKeys.all });
      toast.success("Updated");
      setEditOpen(false);
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
      pageDescription="Menu categories — Starters, Biryani etc. Separate from RawMaterial category. Search, edit, active toggle."
      pageHeaderAction={
        <Link
          href="/dashboard/menu/categories/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add Category
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search categories..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
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
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cats ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.image_url ? (
                        <img
                          src={c.image_url}
                          alt={c.name}
                          className="size-6 rounded object-cover"
                        />
                      ) : (
                        <span className="size-6 rounded bg-muted" />
                      )}
                      <span>{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                  <TableCell className="text-xs">{c.is_active ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" className="h-8 w-8 p-0" />}
                      >
                        <Icons.ellipsis className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() =>
                              (window.location.href = `/dashboard/menu/categories/${c.id}/edit`)
                            }
                          >
                            <Icons.edit className="mr-2 h-4 w-4" /> Update (Page)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditId(c.id);
                              setEditName(c.name);
                              setEditActive(c.is_active);
                              setEditOpen(true);
                            }}
                          >
                            <Icons.edit className="mr-2 h-4 w-4" /> Quick Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteId(c.id);
                              setDeleteOpen(true);
                            }}
                          >
                            <Icons.trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editActive} onCheckedChange={setEditActive} />
              <Label className="text-xs">Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending || !editName}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              Are you sure? Menu items using it will block delete.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && delMut.mutate(deleteId)}
              disabled={delMut.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
