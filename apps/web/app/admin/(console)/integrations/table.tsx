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
import { FIELD_HINTS, KIND_OPTIONS } from "./provider-kinds";

export type Provider = {
  id: string;
  channel: string;
  provider: string;
  displayName: string;
  config: Record<string, string>;
  isActive: boolean;
  lastTestedAt: string | Date | null;
  lastTestOk: boolean | null;
};

async function api(url: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
}

export function IntegrationsTable({ initial }: { initial: Provider[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);

  const { sortKey, sortDir, toggle, sorted } = useSorting<Provider>("displayName", "asc");

  const q = search.trim().toLowerCase();
  const filtered = initial.filter((p) => {
    if (channel !== "all" && p.channel !== channel) return false;
    if (q && !`${p.displayName} ${p.provider} ${p.channel}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const rows = sorted(filtered, {
    displayName: (p) => p.displayName,
    channel: (p) => p.channel,
    provider: (p) => p.provider,
    lastTestedAt: (p) => (p.lastTestedAt ? new Date(p.lastTestedAt).getTime() : 0),
  });
  const table = useResponsiveTableRows(rows, 10);

  function editFields(p: Provider) {
    const kind = KIND_OPTIONS.find((k) => k.channel === p.channel)?.providers.find(
      (x) => x.id === p.provider,
    );
    const blank: Record<string, string> = {};
    for (const f of kind?.fields ?? Object.keys(p.config)) blank[f] = "";
    setFieldValues(blank);
    setEditing(p);
  }

  async function test(p: Provider) {
    setBusy(true);
    try {
      await api("/api/admin/messaging/providers/test", "POST", { id: p.id });
      toast.success(`${p.displayName} reachable`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveCreds() {
    if (!editing) return;
    setBusy(true);
    try {
      await api("/api/admin/messaging/providers", "PATCH", { id: editing.id, config: fieldValues });
      toast.success("Credentials saved (masked values kept)");
      setEditing(null);
      setFieldValues({});
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ListToolbar>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search provider…"
          ariaLabel="Search providers"
        />
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-[160px]" aria-label="Channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {KIND_OPTIONS.map((k) => (
              <SelectItem key={k.channel} value={k.channel} className="capitalize">
                {k.channel}
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
                <EmptyTitle>No providers match</EmptyTitle>
                <EmptyDescription>Add a provider or widen the filter.</EmptyDescription>
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
                      label="Provider"
                      column="displayName"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Channel"
                      column="channel"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Last tested"
                      column="lastTestedAt"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((p) => (
                  <TableRow key={p.id} className={!p.isActive ? "opacity-60" : undefined}>
                    <TableCell>
                      <p className="font-medium">{p.displayName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{p.provider}</p>
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {p.channel}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.lastTestedAt
                        ? `${new Date(p.lastTestedAt).toLocaleString("en-IN")} — ${p.lastTestOk ? "ok" : "failed"}`
                        : "never tested"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "outline" : "secondary"}>
                        {p.isActive ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu rowLabel={p.displayName}>
                        <DropdownMenuItem disabled={busy} onClick={() => void test(p)}>
                          <Icons.refresh className="mr-2 h-4 w-4" /> Test connection
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => editFields(p)}>
                          <Icons.edit className="mr-2 h-4 w-4" /> Edit credentials
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(p)}>
                          <Icons.trash className="mr-2 h-4 w-4" /> Delete
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

      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setFieldValues({});
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credentials — {editing?.displayName}</DialogTitle>
            <DialogDescription>
              Secrets are never echoed back (masked as ••••••). Leave a field blank to keep the
              stored value.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(fieldValues).map((f) => (
              <div key={f} className="grid gap-2">
                <Label htmlFor={`cred-${f}`}>{FIELD_HINTS[f] ?? f}</Label>
                <Input
                  id={`cred-${f}`}
                  type={
                    f.toLowerCase().includes("password") ||
                    f.toLowerCase().includes("token") ||
                    f.toLowerCase().includes("key")
                      ? "password"
                      : "text"
                  }
                  value={fieldValues[f]}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [f]: e.target.value }))}
                  placeholder={editing?.config[f] === "••••••" ? "Stored (blank keeps it)" : ""}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void saveCreds()}>
              Save credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete provider “{deleteTarget?.displayName}”?</DialogTitle>
            <DialogDescription>
              Sends already ledgered stay in history. Future sends fall back to remaining providers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !deleteTarget}
              onClick={() => {
                if (!deleteTarget) return;
                setBusy(true);
                api(`/api/admin/messaging/providers?id=${deleteTarget.id}`, "DELETE")
                  .then(() => {
                    toast.success("Provider deleted");
                    setDeleteTarget(null);
                    router.refresh();
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Delete failed"))
                  .finally(() => setBusy(false));
              }}
            >
              <Icons.trash className="size-3.5" aria-hidden />
              Delete provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
