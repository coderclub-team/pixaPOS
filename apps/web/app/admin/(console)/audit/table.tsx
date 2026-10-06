"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { ListToolbar, SearchInput } from "@/components/admin/list-toolbar";
import { RowActionsMenu, DropdownMenuItem } from "@/components/admin/row-actions";
import {
  LoadMoreSentinel,
  TablePagination,
  useResponsiveTableRows,
} from "@/components/admin/data-pagination";
import { SortTh, useSorting } from "@/components/sort-th";

export type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string | null;
  createdAt: string | Date;
};

export function AuditTable({ initial }: { initial: AuditRow[] }) {
  const [search, setSearch] = useState("");
  const [detailTarget, setDetailTarget] = useState<AuditRow | null>(null);

  const { sortKey, sortDir, toggle, sorted } = useSorting<AuditRow>("createdAt", "desc");

  const q = search.trim().toLowerCase();
  const filtered = initial.filter((r) => {
    if (!q) return true;
    return `${r.action} ${r.entityType} ${r.entityId} ${r.detail ?? ""}`.toLowerCase().includes(q);
  });

  const rows = sorted(filtered, {
    createdAt: (r) => new Date(r.createdAt).getTime(),
    action: (r) => r.action,
    entityType: (r) => r.entityType,
  });
  const table = useResponsiveTableRows(rows, 15);

  return (
    <>
      <ListToolbar>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search action, entity, detail…"
          ariaLabel="Search audit log"
        />
      </ListToolbar>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No audit events match</EmptyTitle>
                <EmptyDescription>Widen the search to review the trail.</EmptyDescription>
              </EmptyHeader>
            </Empty>
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
                      label="When"
                      column="createdAt"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Action"
                      column="action"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Entity"
                      column="entityType"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {r.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.entityType}/{String(r.entityId).slice(0, 12)}…
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                      {r.detail ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu rowLabel={r.action}>
                        <DropdownMenuItem onClick={() => setDetailTarget(r)}>
                          <Icons.externalLink className="mr-2 h-4 w-4" /> View detail
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            void navigator.clipboard?.writeText(r.entityId).then(
                              () => toast.success("Entity ID copied"),
                              () => toast.error("Copy failed"),
                            );
                          }}
                        >
                          <Icons.forms className="mr-2 h-4 w-4" /> Copy entity ID
                        </DropdownMenuItem>
                      </RowActionsMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {table.isDesktop && (
              <TablePagination
                page={table.page}
                totalPages={table.totalPages}
                total={table.total}
                onPageChange={table.setPage}
              />
            )}
          </CardContent>
        </Card>
      )}
      {!table.isDesktop && (
        <LoadMoreSentinel sentinelRef={table.sentinelRef} hasMore={table.hasMore} />
      )}

      <Dialog open={!!detailTarget} onOpenChange={(v) => !v && setDetailTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{detailTarget?.action}</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">When</dt>
            <dd className="col-span-2">
              {detailTarget ? new Date(detailTarget.createdAt).toLocaleString("en-IN") : ""}
            </dd>
            <dt className="text-muted-foreground">Entity</dt>
            <dd className="col-span-2">
              {detailTarget?.entityType} · {detailTarget?.entityId}
            </dd>
            <dt className="text-muted-foreground">Detail</dt>
            <dd className="col-span-2 whitespace-pre-wrap break-words">
              {detailTarget?.detail ?? "—"}
            </dd>
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
