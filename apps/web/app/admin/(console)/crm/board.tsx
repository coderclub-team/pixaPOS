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
import { Textarea } from "@pixa/ui/base-ui/textarea";
import { useAppForm } from "@/lib/form";
import { Icons } from "@pixa/ui/icons";

type Enquiry = {
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

const enquirySchema = z.object({
  businessName: z.string().min(1, "Business name required"),
  contactName: z.string().min(1, "Contact name required"),
  email: z.email("Enter a valid email"),
  phone: z.string().min(7, "Enter a valid phone"),
  city: z.string(),
  outletsPlanned: z.string(),
  source: z.string(),
  notes: z.string(),
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

export function EnquiryBoard({ initial }: { initial: Enquiry[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [followups, setFollowups] = useState<Record<string, Followup[]>>({});
  const [followNote, setFollowNote] = useState("");
  const [followNext, setFollowNext] = useState("");

  const form = useAppForm({
    defaultValues: {
      businessName: "",
      contactName: "",
      email: "",
      phone: "",
      city: "",
      outletsPlanned: "1",
      source: "website",
      notes: "",
    },
    validators: {
      onSubmit: enquirySchema,
    },
    onSubmit: async ({ value }) => {
      setBusy(true);
      try {
        await api("/api/admin/crm/enquiries", "POST", {
          ...value,
          outletsPlanned: Number(value.outletsPlanned) || 1,
        });
        toast.success("Enquiry logged");
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
      await api("/api/admin/crm/enquiries", "PATCH", { id, status });
      toast.success(`Enquiry ${status}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadFollowups(id: string) {
    try {
      const res = await fetch(`/api/admin/crm/followups?enquiryId=${id}`);
      const data = (await res.json()) as { ok?: boolean; followups?: Followup[] };
      if (data.ok) setFollowups((f) => ({ ...f, [id]: data.followups ?? [] }));
    } catch {
      /* panel stays empty */
    }
  }

  async function addFollowup(id: string) {
    if (!followNote.trim()) {
      toast.error("Write the follow-up note first");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/crm/followups", "POST", {
        enquiryId: id,
        note: followNote.trim(),
        nextFollowUpAt: followNext || null,
      });
      toast.success("Follow-up logged");
      setFollowNote("");
      setFollowNext("");
      await loadFollowups(id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const rows = filter === "all" ? initial : initial.filter((e) => e.status === filter);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Log enquiry</CardTitle>
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
                  name="businessName"
                  children={(field) => <field.TextField label="Business" required />}
                />
                <form.AppField
                  name="contactName"
                  children={(field) => <field.TextField label="Contact" required />}
                />
                <form.AppField
                  name="email"
                  children={(field) => <field.TextField label="Email" required type="email" />}
                />
                <form.AppField
                  name="phone"
                  children={(field) => <field.TextField label="Phone" required />}
                />
                <form.AppField name="city" children={(field) => <field.TextField label="City" />} />
                <form.AppField
                  name="outletsPlanned"
                  children={(field) => <field.TextField label="Outlets planned" />}
                />
                <form.AppField
                  name="source"
                  children={(field) => (
                    <field.SelectField
                      label="Source"
                      options={[
                        "website",
                        "youtube",
                        "instagram",
                        "referral",
                        "field-sales",
                        "other",
                      ].map((s) => ({ value: s, label: s }))}
                    />
                  )}
                />
                <form.AppField
                  name="notes"
                  children={(field) => <field.TextField label="Notes" />}
                />
              </div>
            </FieldGroup>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={busy || submitting} className="mt-4">
                  <Icons.add className="size-4" aria-hidden />
                  Log enquiry
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="crm-filter">Status</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger id="crm-filter" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({initial.length})</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s} ({initial.filter((e) => e.status === s).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          No enquiries{filter !== "all" ? " with this status" : " yet"}.
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((e) => (
            <li key={e.id}>
              <Card>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{e.businessName}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.contactName} · {e.email} · {e.phone}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.city ?? "—"} · {e.outletsPlanned} outlet(s) · {e.source}
                      {e.assignedTo ? ` · Owner: ${e.assignedTo}` : ""}
                    </p>
                    {e.notes && <p className="mt-2 text-sm">{e.notes}</p>}
                    {openId === e.id && (
                      <div className="mt-3 space-y-2 rounded-lg bg-muted p-3">
                        {(followups[e.id] ?? []).map((f) => (
                          <div key={f.id} className="text-sm">
                            <p>{f.note}</p>
                            <p className="text-xs text-muted-foreground">
                              {f.authorEmail ?? ""} ·{" "}
                              {new Date(f.createdAt).toLocaleString("en-IN")}
                              {f.nextFollowUpAt
                                ? ` · next: ${new Date(f.nextFollowUpAt).toLocaleString("en-IN")}`
                                : ""}
                            </p>
                          </div>
                        ))}
                        {(followups[e.id] ?? []).length === 0 && (
                          <p className="text-xs text-muted-foreground">No follow-ups yet.</p>
                        )}
                        <div className="flex flex-wrap items-end gap-2 pt-1">
                          <div className="grid min-w-52 flex-1 gap-1.5">
                            <Label htmlFor={`fn-${e.id}`}>Follow-up note</Label>
                            <Textarea
                              id={`fn-${e.id}`}
                              rows={2}
                              value={followNote}
                              onChange={(ev) => setFollowNote(ev.target.value)}
                              placeholder="Called, demo booked…"
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`fx-${e.id}`}>Next follow-up</Label>
                            <Input
                              id={`fx-${e.id}`}
                              type="datetime-local"
                              value={followNext}
                              onChange={(ev) => setFollowNext(ev.target.value)}
                            />
                          </div>
                          <Button size="sm" disabled={busy} onClick={() => void addFollowup(e.id)}>
                            Log
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant={
                        e.status === "lost"
                          ? "destructive"
                          : e.status === "converted"
                            ? "default"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {e.status}
                    </Badge>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const next = openId === e.id ? null : e.id;
                          setOpenId(next);
                          if (next) void loadFollowups(e.id);
                        }}
                      >
                        Follow-ups
                      </Button>
                      {STATUSES.filter((s) => s !== e.status).map((s) => (
                        <Button
                          key={s}
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void setStatus(e.id, s)}
                          className="capitalize"
                        >
                          → {s}
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
