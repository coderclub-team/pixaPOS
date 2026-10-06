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
import { Textarea } from "@pixa/ui/base-ui/textarea";
import { Icons } from "@pixa/ui/icons";
import { ListToolbar, SearchInput } from "@/components/admin/list-toolbar";
import { RowActionsMenu, DropdownMenuItem } from "@/components/admin/row-actions";
import {
  LoadMoreSentinel,
  TablePagination,
  useResponsiveTableRows,
} from "@/components/admin/data-pagination";
import { SortTh, useSorting } from "@/components/sort-th";

export type Enquiry = {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string | null;
  outletsPlanned: number;
  source: string;
  status: string;
  assignedTo: string | null;
  notes: string | null;
  createdAt: string | Date;
};

type Followup = {
  id: string;
  note: string;
  nextFollowUpAt: string | Date | null;
  authorEmail: string | null;
  createdAt: string | Date;
};

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"];

const STATUS_TONE: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
  new: "secondary",
  contacted: "outline",
  qualified: "default",
  converted: "default",
  lost: "destructive",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_TONE[status] ?? "secondary"} className="capitalize">
      {status}
    </Badge>
  );
}

async function api(url: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
}

export function EnquiriesTable({ initial }: { initial: Enquiry[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [followTarget, setFollowTarget] = useState<Enquiry | null>(null);
  const [lostTarget, setLostTarget] = useState<Enquiry | null>(null);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [followNote, setFollowNote] = useState("");
  const [followNext, setFollowNext] = useState("");

  const { sortKey, sortDir, toggle, sorted } = useSorting<Enquiry>("createdAt", "desc");

  const q = search.trim().toLowerCase();
  const filtered = initial.filter((e) => {
    if (status !== "all" && e.status !== status) return false;
    if (q && !`${e.businessName} ${e.contactName} ${e.email} ${e.phone}`.toLowerCase().includes(q))
      return false;
    return true;
  });

  const rows = sorted(filtered, {
    businessName: (e) => e.businessName,
    contactName: (e) => e.contactName,
    city: (e) => e.city ?? "",
    outletsPlanned: (e) => e.outletsPlanned,
    source: (e) => e.source,
    status: (e) => e.status,
    createdAt: (e) => new Date(e.createdAt).getTime(),
  });
  const table = useResponsiveTableRows(rows, 10);

  async function changeStatus(id: string, next: string) {
    setBusy(true);
    try {
      await api("/api/admin/crm/enquiries", "PATCH", { id, status: next });
      toast.success(`Enquiry marked ${next}`);
      setLostTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function openFollowups(e: Enquiry) {
    setFollowTarget(e);
    setFollowups([]);
    setFollowNote("");
    setFollowNext("");
    try {
      const res = await fetch(`/api/admin/crm/followups?enquiryId=${e.id}`);
      const data = (await res.json()) as { ok?: boolean; followups?: Followup[] };
      if (data.ok) setFollowups(data.followups ?? []);
    } catch {
      /* panel stays empty */
    }
  }

  async function addFollowup() {
    if (!followTarget) return;
    if (!followNote.trim()) {
      toast.error("Write the follow-up note first");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/crm/followups", "POST", {
        enquiryId: followTarget.id,
        note: followNote.trim(),
        nextFollowUpAt: followNext || null,
      });
      toast.success("Follow-up logged");
      setFollowNote("");
      setFollowNext("");
      await openFollowups(followTarget);
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
          placeholder="Search business, contact, email…"
          ariaLabel="Search enquiries"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
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
                <EmptyTitle>No enquiries match</EmptyTitle>
                <EmptyDescription>Log an enquiry or widen the filter.</EmptyDescription>
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
                      label="Business"
                      column="businessName"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Contact"
                      column="contactName"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="City"
                      column="city"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Outlets"
                      column="outletsPlanned"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Source"
                      column="source"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggle}
                    />
                  </TableHead>
                  <TableHead>
                    <SortTh
                      label="Status"
                      column="status"
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
                {table.rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <p className="font-medium">{e.businessName}</p>
                      {e.notes && (
                        <p className="max-w-xs truncate text-xs text-muted-foreground">{e.notes}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{e.contactName}</p>
                      <p className="text-xs text-muted-foreground">{e.email}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.city ?? "—"}</TableCell>
                    <TableCell className="text-sm">{e.outletsPlanned}</TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {e.source}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu rowLabel={e.businessName}>
                        <DropdownMenuItem onClick={() => void openFollowups(e)}>
                          <Icons.chat className="mr-2 h-4 w-4" /> Log follow-up
                        </DropdownMenuItem>
                        {STATUSES.filter((s) => s !== e.status && s !== "lost").map((s) => (
                          <DropdownMenuItem key={s} onClick={() => void changeStatus(e.id, s)}>
                            <Icons.check className="mr-2 h-4 w-4" /> Mark {s}
                          </DropdownMenuItem>
                        ))}
                        {e.status !== "lost" && (
                          <DropdownMenuItem variant="destructive" onClick={() => setLostTarget(e)}>
                            <Icons.close className="mr-2 h-4 w-4" /> Mark lost
                          </DropdownMenuItem>
                        )}
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
        open={!!followTarget}
        onOpenChange={(v) => {
          if (!v) setFollowTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow-ups — {followTarget?.businessName}</DialogTitle>
            <DialogDescription>Log contact and queue the next follow-up date.</DialogDescription>
          </DialogHeader>
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg bg-muted p-3">
            {followups.map((f) => (
              <div key={f.id} className="text-sm">
                <p>{f.note}</p>
                <p className="text-xs text-muted-foreground">
                  {f.authorEmail ?? ""} · {new Date(f.createdAt).toLocaleString("en-IN")}
                  {f.nextFollowUpAt
                    ? ` · next: ${new Date(f.nextFollowUpAt).toLocaleString("en-IN")}`
                    : ""}
                </p>
              </div>
            ))}
            {followups.length === 0 && (
              <p className="text-xs text-muted-foreground">No follow-ups yet.</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="crm-follow-note">Follow-up note</Label>
              <Textarea
                id="crm-follow-note"
                rows={2}
                value={followNote}
                onChange={(e) => setFollowNote(e.target.value)}
                placeholder="Called, demo booked…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="crm-follow-next">Next follow-up</Label>
              <Input
                id="crm-follow-next"
                type="datetime-local"
                value={followNext}
                onChange={(e) => setFollowNext(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowTarget(null)}>
              Close
            </Button>
            <Button disabled={busy} onClick={() => void addFollowup()}>
              Log follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lostTarget} onOpenChange={(v) => !v && setLostTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {lostTarget?.businessName} lost?</DialogTitle>
            <DialogDescription>
              The enquiry leaves the active pipeline. You can still see it under the “lost” filter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !lostTarget}
              onClick={() => lostTarget && void changeStatus(lostTarget.id, "lost")}
            >
              Mark lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
