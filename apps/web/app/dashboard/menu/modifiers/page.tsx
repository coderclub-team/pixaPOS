"use client";

import * as React from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/page-container";
import { menuKeys, modifierGroupsQueryOptions } from "@/features/menu/api/queries";
import { deleteModifierGroup, updateModifierGroup } from "@/features/menu/api/service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import { Switch } from "@pixa/ui/base-ui/switch";
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
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SortTh, useSorting } from "@/components/sort-th";
import { ExportButton, ImportDialog } from "@/features/system/components/io-dialog";
import {
  importModifierGroups,
  importModifiers,
  modifierColumns,
  modifierGroupColumns,
  modifierGroupSample,
  modifierSample,
} from "@/features/menu/lib/io-modifiers";

export default function ModifiersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: groups, isPending } = useQuery(modifierGroupsQueryOptions());
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const visible = (groups ?? []).filter(
    (g) => !search || g.name.toLowerCase().includes(search.toLowerCase()),
  );
  const groupNameById = React.useMemo(
    () => new Map((groups ?? []).map((g) => [g.id, g.name])),
    [groups],
  );

  const { sortKey, sortDir, toggle, sorted } = useSorting<(typeof visible)[number]>("name");
  const rows = sorted(visible, {
    name: (g) => g.name,
    required: (g) => g.min_selection > 0,
    min: (g) => g.min_selection,
    max: (g) => g.max_selection,
    active: (g) => g.is_active,
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteModifierGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.all });
      toast.success("Deleted");
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateModifierGroup(id, { is_active: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: menuKeys.all }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending)
    return (
      <PageContainer pageTitle="Add-ons" isLoading>
        <div />
      </PageContainer>
    );

  return (
    <PageContainer
      pageTitle="Add-ons"
      pageDescription="Add-on groups (toppings, spice levels) with min/max rules — linked from menu items."
      pageHeaderAction={
        <Link
          href="/dashboard/menu/modifiers/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add Group
        </Link>
      }
    >
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this group?</DialogTitle>
            <DialogDescription>
              Its options go with it. Groups linked to menu items cannot be deleted — unlink first.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => deleteId && delMut.mutate(deleteId)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search groups…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <span className="ml-auto flex gap-2">
          <ExportButton filename="modifier-groups" rows={visible} columns={modifierGroupColumns} />
          <ImportDialog
            title="Bulk import add-on groups"
            sampleFilename="modifier-groups"
            columns={modifierGroupColumns}
            sampleRows={modifierGroupSample}
            onImport={importModifierGroups}
            onDone={() => queryClient.invalidateQueries({ queryKey: menuKeys.all })}
          />
          <ImportDialog
            title="Bulk import add-on options"
            sampleFilename="modifier-options"
            columns={modifierColumns(groupNameById)}
            sampleRows={modifierSample}
            onImport={importModifiers}
            onDone={() => queryClient.invalidateQueries({ queryKey: menuKeys.all })}
            triggerLabel="Import Options"
          />
        </span>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">No add-on groups</p>
            <p className="text-sm text-muted-foreground">
              Create groups like Toppings or Spice Level, then link them from menu items.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortTh
                      label="Group"
                      column="name"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Rule"
                      column="required"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Min–Max"
                      column="min"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Active"
                      column="active"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <span className="font-medium">{g.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.min_selection > 0 ? "default" : "outline"}>
                        {g.min_selection > 0 ? "Required" : "Optional"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {g.min_selection}–{g.max_selection}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {g.max_selection === 1 ? "single" : "multi"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={g.is_active}
                        onCheckedChange={(v) => toggleMut.mutate({ id: g.id, active: v })}
                        aria-label={`${g.name} active`}
                      />
                    </TableCell>
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
                              onClick={() => router.push(`/dashboard/menu/modifiers/${g.id}/edit`)}
                            >
                              <Icons.edit className="mr-2 h-4 w-4" /> Manage options
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteId(g.id);
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
      )}
    </PageContainer>
  );
}
