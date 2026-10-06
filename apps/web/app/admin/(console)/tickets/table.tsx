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

export type Ticket = {
  id: string;
  organizationId: string | null;
  subject: string;
  description: string;
  channel: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  reporterEmail: string | null;
  createdAt: string | Date;
  resolvedAt: string | Date | null;
};

type Note = { id: string; note: string; authorEmail: string | null; createdAt: string | Date };

const STATUSES = ["open", "in_progress", "resolved", "closed"];

const STATUS_TONE: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
  open: "destructive",
  in_progress: "default",
  resolved: "secondary",
  closed: "outline",
};

const PRIORITY_TONE: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
  low: "outline",
  normal: "secondary",
  high: "default",
  urgent: "destructive",
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

export function TicketsTable({ initial }: { initial: Ticket[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [workTarget, setWorkTarget] = useState<Ticket | null>(null);
  const [closeTarget, setCloseTarget] = useState<{ ticket: Ticket; status: string } | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [assignee, setAssignee] = useState("");

  const { sortKey, sortDir, toggle, sorted } = useSorting<Ticket>("createdAt", "desc");

  const q = search.trim().toLowerCase();
  const filtered = initial.filter((t) => {
    if (status !== "all" && t.status !== status) return false;
    if (q && !`${t.subject} ${t.description} ${t.reporterEmail ?? ""}`.toLowerCase().includes(q))
      return false;
    return true;
  });

  const rows = sorted(filtered, {
    subject: (t) => t.subject,
    channel: (t) => t.channel,
    priority: (t) => t.priority,
    status: (t) => t.status,
    assignedTo: (t) => t.assignedTo ?? "",
    createdAt: (t) => new Date(t.createdAt).getTime(),
  });
  const table = useResponsiveTableRows(rows, 10);

  async function changeStatus(id: string, next: string) {
    setBusy(true);
    try {
      await api("/api/admin/tickets", "PATCH", { id, status: next });
      toast.success(`Ticket ${next.replace("_", " ")}`);
      setCloseTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function openWork(t: Ticket) {
    setWorkTarget(t);
    setNotes([]);
    setNoteText("");
    setAssignee(t.assignedTo ?? "");
    try {
      const res = await fetch(`/api/admin/tickets/notes?ticketId=${t.id}`);
      const data = (await res.json()) as { ok?: boolean; notes?: Note[] };
      if (data.ok) setNotes(data.notes ?? []);
    } catch {
      /* panel stays empty */
    }
  }

  async function addNote() {
    if (!workTarget) return;
    if (!noteText.trim()) {
      toast.error("Write the note first");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/tickets/notes", "POST", {
        ticketId: workTarget.id,
        note: noteText.trim(),
      });
      toast.success("Note added");
      setNoteText("");
      await openWork(workTarget);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!workTarget) return;
    if (!assignee.trim()) {
      toast.error("Enter who owns this ticket");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/tickets", "PATCH", { id: workTarget.id, assignedTo: assignee.trim() });
      toast.success("Ticket assigned");
      await openWork(workTarget);
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
          placeholder="Search subject, reporter…"
          ariaLabel="Search tickets"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
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
                <EmptyTitle>No tickets match</EmptyTitle>
                <EmptyDescription>Open a ticket or widen the filter.</EmptyDescription>
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
                      label="Subject"
                      column="subject"
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
                      label="Priority"
                      column="priority"
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
                      label="Owner"
                      column="assignedTo"
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
                {table.rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-medium">{t.subject}</p>
                      <p className="max-w-xs truncate text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {t.channel}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={PRIORITY_TONE[t.priority] ?? "secondary"}
                        className="capitalize"
                      >
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[t.status] ?? "secondary"} className="capitalize">
                        {t.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.assignedTo ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu rowLabel={t.subject}>
                        <DropdownMenuItem onClick={() => void openWork(t)}>
                          <Icons.chat className="mr-2 h-4 w-4" /> Work ticket
                        </DropdownMenuItem>
                        {t.status !== "in_progress" && t.status !== "closed" && (
                          <DropdownMenuItem onClick={() => void changeStatus(t.id, "in_progress")}>
                            <Icons.clock className="mr-2 h-4 w-4" /> Start work
                          </DropdownMenuItem>
                        )}
                        {t.status !== "resolved" && (
                          <DropdownMenuItem
                            onClick={() => setCloseTarget({ ticket: t, status: "resolved" })}
                          >
                            <Icons.check className="mr-2 h-4 w-4" /> Mark resolved
                          </DropdownMenuItem>
                        )}
                        {t.status !== "closed" && (
                          <DropdownMenuItem
                            onClick={() => setCloseTarget({ ticket: t, status: "closed" })}
                          >
                            <Icons.close className="mr-2 h-4 w-4" /> Close
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
        open={!!workTarget}
        onOpenChange={(v) => {
          if (!v) setWorkTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Work ticket — {workTarget?.subject}</DialogTitle>
            <DialogDescription>Add notes and assign an owner.</DialogDescription>
          </DialogHeader>
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg bg-muted p-3">
            {notes.map((n) => (
              <div key={n.id} className="text-sm">
                <p>{n.note}</p>
                <p className="text-xs text-muted-foreground">
                  {n.authorEmail ?? ""} · {new Date(n.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
            {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tkt-note">Add note</Label>
            <Textarea
              id="tkt-note"
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Called back, fix shipped…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tkt-assignee">Assign to</Label>
            <div className="flex gap-2">
              <Input
                id="tkt-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="owner email"
              />
              <Button variant="outline" disabled={busy} onClick={() => void assign()}>
                Assign
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkTarget(null)}>
              Close
            </Button>
            <Button disabled={busy} onClick={() => void addNote()}>
              Add note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeTarget} onOpenChange={(v) => !v && setCloseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {closeTarget?.status === "closed" ? "Close" : "Mark resolved"} —{" "}
              {closeTarget?.ticket.subject}?
            </DialogTitle>
            <DialogDescription>
              {closeTarget?.status === "closed"
                ? "A closed ticket is final; it stays in history."
                : "The ticket leaves the open queue but can still be worked."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !closeTarget}
              onClick={() =>
                closeTarget && void changeStatus(closeTarget.ticket.id, closeTarget.status)
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
