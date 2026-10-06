"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Badge } from "@pixa/ui/base-ui/badge";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { useAppForm } from "@/lib/form";
import { Icons } from "@pixa/ui/icons";

type Ticket = {
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

const PRIORITIES = ["low", "normal", "high", "urgent"];
const STATUSES = ["open", "in_progress", "resolved", "closed"];
const CHANNELS = ["app", "phone", "email", "whatsapp", "field"];

const ticketSchema = z.object({
  subject: z.string().min(1, "Subject required"),
  description: z.string().min(1, "Describe the complaint"),
  organizationId: z.string(),
  priority: z.string(),
  channel: z.string(),
  reporterEmail: z.string(),
});

async function api(url: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
}

export function TicketBoard({ initial }: { initial: Ticket[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("open-work");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [noteText, setNoteText] = useState("");
  const [assignee, setAssignee] = useState("");

  const form = useAppForm({
    defaultValues: {
      subject: "",
      description: "",
      organizationId: "",
      priority: "normal",
      channel: "app",
      reporterEmail: "",
    },
    validators: { onSubmit: ticketSchema },
    onSubmit: async ({ value }) => {
      setBusy(true);
      try {
        await api("/api/admin/tickets", "POST", {
          ...value,
          organizationId: value.organizationId.trim() || null,
          reporterEmail: value.reporterEmail.trim() || null,
        });
        toast.success("Ticket opened");
        form.reset();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
  });

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      await api("/api/admin/tickets", "PATCH", { id, status });
      toast.success(`Ticket ${status.replace("_", " ")}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign(id: string) {
    if (!assignee.trim()) {
      toast.error("Enter who owns this ticket");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/tickets", "PATCH", { id, assignedTo: assignee.trim() });
      toast.success("Ticket assigned");
      setAssignee("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadNotes(id: string) {
    try {
      const res = await fetch(`/api/admin/tickets/notes?ticketId=${id}`);
      const data = (await res.json()) as { ok?: boolean; notes?: Note[] };
      if (data.ok) setNotes((n) => ({ ...n, [id]: data.notes ?? [] }));
    } catch {
      /* panel stays empty */
    }
  }

  async function addNote(id: string) {
    if (!noteText.trim()) {
      toast.error("Write the note first");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/tickets/notes", "POST", { ticketId: id, note: noteText.trim() });
      toast.success("Note added");
      setNoteText("");
      await loadNotes(id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const rows =
    filter === "all"
      ? initial
      : filter === "open-work"
        ? initial.filter((t) => t.status === "open" || t.status === "in_progress")
        : initial.filter((t) => t.status === filter);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Open ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.AppField
                  name="subject"
                  children={(field) => <field.TextField label="Subject" required />}
                />
                <form.AppField
                  name="reporterEmail"
                  children={(field) => <field.TextField label="Reporter email" type="email" />}
                />
                <form.AppField
                  name="organizationId"
                  children={(field) => <field.TextField label="Organisation ID (optional)" />}
                />
                <form.AppField
                  name="priority"
                  children={(field) => (
                    <field.SelectField
                      label="Priority"
                      options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                    />
                  )}
                />
                <form.AppField
                  name="channel"
                  children={(field) => (
                    <field.SelectField
                      label="Channel"
                      options={CHANNELS.map((c) => ({ value: c, label: c }))}
                    />
                  )}
                />
                <form.AppField
                  name="description"
                  children={(field) => <field.TextField label="Description" required />}
                />
              </div>
            </FieldGroup>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={busy || submitting} className="mt-4">
                  <Icons.add className="size-4" aria-hidden />
                  Open ticket
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Label htmlFor="tkt-filter">Show</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger id="tkt-filter" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open-work">Open work</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          No tickets here. The queue is clear.
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((t) => (
            <li key={t.id}>
              <Card className={t.priority === "urgent" ? "border-destructive" : undefined}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{t.subject}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.channel} · {t.reporterEmail ?? "no reporter"} ·{" "}
                      {new Date(t.createdAt).toLocaleString("en-IN")}
                      {t.assignedTo ? ` · Owner: ${t.assignedTo}` : " · Unassigned"}
                    </p>
                    {openId === t.id && (
                      <div className="mt-3 space-y-2 rounded-lg bg-muted p-3">
                        {(notes[t.id] ?? []).map((n) => (
                          <div key={n.id} className="text-sm">
                            <p>{n.note}</p>
                            <p className="text-xs text-muted-foreground">
                              {n.authorEmail ?? ""} ·{" "}
                              {new Date(n.createdAt).toLocaleString("en-IN")}
                            </p>
                          </div>
                        ))}
                        {(notes[t.id] ?? []).length === 0 && (
                          <p className="text-xs text-muted-foreground">No notes yet.</p>
                        )}
                        <div className="flex flex-wrap items-end gap-2 pt-1">
                          <div className="grid min-w-52 flex-1 gap-1.5">
                            <Label htmlFor={`tn-${t.id}`}>Add note</Label>
                            <Input
                              id={`tn-${t.id}`}
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Called back, fix shipped…"
                            />
                          </div>
                          <Button size="sm" disabled={busy} onClick={() => void addNote(t.id)}>
                            Add
                          </Button>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`ta-${t.id}`}>Assign to</Label>
                            <div className="flex gap-2">
                              <Input
                                id={`ta-${t.id}`}
                                value={assignee}
                                onChange={(e) => setAssignee(e.target.value)}
                                placeholder="owner email"
                                className="w-44"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void assign(t.id)}
                              >
                                Assign
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1.5">
                      <Badge
                        variant={
                          t.status === "open"
                            ? "destructive"
                            : t.status === "closed"
                              ? "secondary"
                              : "default"
                        }
                        className="capitalize"
                      >
                        {t.status.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {t.priority}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const next = openId === t.id ? null : t.id;
                          setOpenId(next);
                          if (next) void loadNotes(t.id);
                        }}
                      >
                        Work it
                      </Button>
                      {STATUSES.filter((s) => s !== t.status).map((s) => (
                        <Button
                          key={s}
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void setStatus(t.id, s)}
                          className="capitalize"
                        >
                          → {s.replace("_", " ")}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
