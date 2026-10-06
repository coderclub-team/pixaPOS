"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import { Icons } from "@pixa/ui/icons";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { ListToolbar, SearchInput } from "@/components/admin/list-toolbar";
import { RowActionsMenu, DropdownMenuItem } from "@/components/admin/row-actions";
import {
  LoadMoreSentinel,
  TablePagination,
  useResponsiveTableRows,
} from "@/components/admin/data-pagination";
import { SortTh, useSorting } from "@/components/sort-th";

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string | Date;
  profile: { lifecycle: string | null; plan: string | null } | null;
  seats: number;
};

const LIFECYCLES = ["trial", "active", "past_due", "suspended", "churned"];

const LIFECYCLE_TONE: Record<
  string,
  "default" | "secondary" | "outline" | "destructive" | "ghost"
> = {
  trial: "secondary",
  active: "default",
  past_due: "outline",
  suspended: "destructive",
  churned: "ghost",
};

export function LifecycleBadge({ value }: { value: string }) {
  return (
    <Badge variant={LIFECYCLE_TONE[value] ?? "secondary"} className="capitalize">
      {value.replace("_", " ")}
    </Badge>
  );
}

export function OrgList({ initial }: { initial: OrgRow[] }) {
  const [search, setSearch] = useState("");
  const [lifecycle, setLifecycle] = useState("all");
  const { sortKey, sortDir, toggle, sorted } = useSorting<OrgRow>("createdAt", "desc");

  const q = search.trim().toLowerCase();
  const filtered = initial.filter((o) => {
    if (lifecycle !== "all" && (o.profile?.lifecycle ?? "trial") !== lifecycle) return false;
    if (q && !`${o.name} ${o.slug}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const rows = sorted(filtered, {
    name: (o) => o.name,
    lifecycle: (o) => o.profile?.lifecycle ?? "trial",
    plan: (o) => o.profile?.plan ?? "starter",
    seats: (o) => o.seats,
    createdAt: (o) => new Date(o.createdAt).getTime(),
  });
  const table = useResponsiveTableRows(rows, 10);

  return (
    <>
      <ListToolbar>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search by name or slug…"
          ariaLabel="Search organisations"
        />
        <Select value={lifecycle} onValueChange={setLifecycle}>
          <SelectTrigger className="w-[160px]" aria-label="Lifecycle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lifecycles</SelectItem>
            {LIFECYCLES.map((l) => (
              <SelectItem key={l} value={l} className="capitalize">
                {l.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ListToolbar>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No organisations match</EmptyTitle>
                <EmptyDescription>Try widening the search or clearing the filter.</EmptyDescription>
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
                      label="Organisation"
                      column="name"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Lifecycle"
                      column="lifecycle"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Plan"
                      column="plan"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Seats"
                      column="seats"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Created"
                      column="createdAt"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <p className="font-medium">{o.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.slug} · {o.id.slice(0, 8)}…
                      </p>
                    </TableCell>
                    <TableCell>
                      <LifecycleBadge value={o.profile?.lifecycle ?? "trial"} />
                    </TableCell>
                    <TableCell className="capitalize">{o.profile?.plan ?? "starter"}</TableCell>
                    <TableCell>{o.seats}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <OrgRowActions org={o} />
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
    </>
  );
}

function OrgRowActions({ org }: { org: OrgRow }) {
  const router = useRouter();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const isSuspended = (org.profile?.lifecycle ?? "trial") === "suspended";

  async function patch(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Save failed");
      toast.success(done);
      setSuspendOpen(false);
      setConfirmPassword("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {org.name}?</DialogTitle>
            <DialogDescription>
              Billing stops and access is blocked immediately. Enter your password to confirm — this
              is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="org-suspend-confirm">Your password</Label>
            <Input
              id="org-suspend-confirm"
              type="password"
              autoComplete="current-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !confirmPassword}
              onClick={() =>
                void patch(
                  { isBlocked: true, lifecycle: "suspended", confirmPassword },
                  "Organisation suspended",
                )
              }
            >
              Confirm suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end">
        <RowActionsMenu rowLabel={org.name}>
          <DropdownMenuItem onClick={() => router.push(`/admin/organizations/${org.id}`)}>
            <Icons.externalLink className="mr-2 h-4 w-4" /> Open organisation
          </DropdownMenuItem>
          {isSuspended ? (
            <DropdownMenuItem
              onClick={() =>
                void patch({ isBlocked: false, lifecycle: "active" }, "Organisation activated")
              }
            >
              <Icons.check className="mr-2 h-4 w-4" /> Activate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setSuspendOpen(true)}>
              <Icons.lock className="mr-2 h-4 w-4" /> Suspend
            </DropdownMenuItem>
          )}
        </RowActionsMenu>
      </div>
    </>
  );
}
