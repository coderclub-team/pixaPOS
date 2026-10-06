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
import { Icons } from "@pixa/ui/icons";
import { ListToolbar, SearchInput } from "@/components/admin/list-toolbar";
import { RowActionsMenu, DropdownMenuItem } from "@/components/admin/row-actions";
import {
  LoadMoreSentinel,
  TablePagination,
  useResponsiveTableRows,
} from "@/components/admin/data-pagination";
import { SortTh, useSorting } from "@/components/sort-th";

export type Owner = {
  id: string;
  email: string;
  role: string;
  roleId: string | null;
  isActive: boolean;
};

async function api(url: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
}

export function OwnersTable({
  owners,
  roles,
}: {
  owners: Owner[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Owner | null>(null);
  const [roleValue, setRoleValue] = useState("none");
  const [deactivateTarget, setDeactivateTarget] = useState<Owner | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetTarget, setResetTarget] = useState<Owner | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const roleOptions = [
    { value: "none", label: "Staff (no role)" },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];

  const { sortKey, sortDir, toggle, sorted } = useSorting<Owner>("email", "asc");

  const q = search.trim().toLowerCase();
  const filtered = owners.filter((o) => {
    if (roleFilter === "active" && !o.isActive) return false;
    if (roleFilter === "inactive" && o.isActive) return false;
    if (q && !o.email.toLowerCase().includes(q)) return false;
    return true;
  });

  const rows = sorted(filtered, {
    email: (o) => o.email,
    role: (o) => (o.role === "super_owner" ? "super owner" : (o.roleId ?? "staff")),
    isActive: (o) => o.isActive,
  });
  const table = useResponsiveTableRows(rows, 10);

  const saveRow = async (id: string, patch: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await api(`/api/admin/owners/${id}`, "PATCH", patch);
      toast.success(done);
      setDeactivateTarget(null);
      setResetTarget(null);
      setRoleTarget(null);
      setConfirmPassword("");
      setNewPassword("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ListToolbar>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search by email…"
          ariaLabel="Search owner users"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </ListToolbar>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No owner users match</EmptyTitle>
                <EmptyDescription>Invite staff or widen the filter.</EmptyDescription>
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
                      label="Email"
                      column="email"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Role"
                      column="role"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Active"
                      column="isActive"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((o) => {
                  const isSuper = o.role === "super_owner";
                  const roleLabel = isSuper
                    ? "super owner"
                    : (roles.find((r) => r.id === o.roleId)?.name ?? "staff");
                  return (
                    <TableRow key={o.id} className={!o.isActive ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">{o.email}</TableCell>
                      <TableCell>
                        <Badge variant={isSuper ? "default" : "secondary"} className="capitalize">
                          {roleLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={o.isActive ? "outline" : "destructive"}>
                          {o.isActive ? "active" : "deactivated"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isSuper ? (
                          <span className="text-xs text-muted-foreground">Protected</span>
                        ) : (
                          <RowActionsMenu rowLabel={o.email}>
                            <DropdownMenuItem
                              onClick={() => {
                                setRoleTarget(o);
                                setRoleValue(o.roleId ?? "none");
                              }}
                            >
                              <Icons.lock className="mr-2 h-4 w-4" /> Change role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setResetTarget(o)}>
                              <Icons.refresh className="mr-2 h-4 w-4" /> Reset password
                            </DropdownMenuItem>
                            {o.isActive ? (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeactivateTarget(o)}
                              >
                                <Icons.close className="mr-2 h-4 w-4" /> Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  void saveRow(o.id, { isActive: true }, `${o.email} activated`)
                                }
                              >
                                <Icons.check className="mr-2 h-4 w-4" /> Activate
                              </DropdownMenuItem>
                            )}
                          </RowActionsMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <Dialog open={!!roleTarget} onOpenChange={(v) => !v && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role — {roleTarget?.email}</DialogTitle>
            <DialogDescription>Pick the scoped role this staff user should hold.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="owner-role">Role</Label>
            <Select value={roleValue} onValueChange={setRoleValue} disabled={busy}>
              <SelectTrigger id="owner-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !roleTarget}
              onClick={() =>
                roleTarget &&
                void saveRow(
                  roleTarget.id,
                  { roleId: roleValue === "none" ? null : roleValue },
                  `Role updated for ${roleTarget.email}`,
                )
              }
            >
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {deactivateTarget?.email}?</DialogTitle>
            <DialogDescription>
              They lose console access immediately and all their sessions are revoked. Enter your
              password to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="deactivate-confirm">Your password</Label>
            <Input
              id="deactivate-confirm"
              type="password"
              autoComplete="current-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !confirmPassword || !deactivateTarget}
              onClick={() =>
                deactivateTarget &&
                void saveRow(
                  deactivateTarget.id,
                  { isActive: false, confirmPassword },
                  `${deactivateTarget.email} deactivated`,
                )
              }
            >
              Confirm deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {resetTarget?.email}?</DialogTitle>
            <DialogDescription>
              They are logged out everywhere immediately. Enter your password to confirm, plus their
              new one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="reset-confirm">Your password</Label>
              <Input
                id="reset-confirm"
                type="password"
                autoComplete="current-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reset-new">Their new password (12+ chars)</Label>
              <Input
                id="reset-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !confirmPassword || newPassword.length < 12 || !resetTarget}
              onClick={() =>
                resetTarget &&
                void saveRow(
                  resetTarget.id,
                  { password: newPassword, confirmPassword },
                  `Password reset for ${resetTarget.email}`,
                )
              }
            >
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
