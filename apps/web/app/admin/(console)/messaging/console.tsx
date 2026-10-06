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

type Template = {
  id: string;
  channel: string;
  name: string;
  subject: string | null;
  body: string;
  variables: string[];
};

type Provider = { id: string; channel: string; displayName: string; isActive: boolean };

type OutboxRow = {
  id: string;
  channel: string;
  to: string;
  status: string;
  error: string | null;
  createdBy: string | null;
  createdAt: string | Date;
};

const templateSchema = z.object({
  channel: z.string().min(1),
  name: z.string().min(1, "Name required"),
  subject: z.string(),
  body: z.string().min(1, "Body required"),
});

async function api(url: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    sent?: number;
    total?: number;
  } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
  return data;
}

export function MessagingConsole({
  initialTemplates,
  initialProviders,
  initialOutbox,
}: {
  initialTemplates: Template[];
  initialProviders: Provider[];
  initialOutbox: OutboxRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sendChannel, setSendChannel] = useState("whatsapp");
  const [sendProvider, setSendProvider] = useState("");
  const [sendTemplate, setSendTemplate] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendSubject, setSendSubject] = useState("");

  const form = useAppForm({
    defaultValues: { channel: "whatsapp", name: "", subject: "", body: "" },
    validators: { onSubmit: templateSchema },
    onSubmit: async ({ value }) => {
      setBusy(true);
      try {
        await api("/api/admin/messaging/templates", "POST", value);
        toast.success("Template saved");
        form.reset();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
  });

  const channelProviders = initialProviders.filter((p) => p.channel === sendChannel && p.isActive);

  function pickTemplate(id: string) {
    setSendTemplate(id);
    const t = initialTemplates.find((x) => x.id === id);
    if (t) {
      setSendBody(t.body);
      setSendSubject(t.subject ?? "");
    }
  }

  async function send() {
    const to = sendTo
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (to.length === 0) {
      toast.error("Add at least one recipient");
      return;
    }
    if (!sendBody.trim()) {
      toast.error("Message body required");
      return;
    }
    setBusy(true);
    try {
      const data = await api("/api/admin/messaging/send", "POST", {
        channel: sendChannel,
        providerId: sendProvider || undefined,
        templateId: sendTemplate || undefined,
        to,
        subject: sendSubject,
        body: sendBody,
      });
      toast.success(`Sent ${data.sent ?? 0}/${data.total ?? to.length}`);
      setSendTo("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compose & send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="send-channel">Channel</Label>
                <Select
                  value={sendChannel}
                  onValueChange={(v) => {
                    setSendChannel(v);
                    setSendProvider("");
                    setSendTemplate("");
                  }}
                >
                  <SelectTrigger id="send-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["whatsapp", "sms", "email"].map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="send-provider">Provider</Label>
                <Select value={sendProvider} onValueChange={setSendProvider}>
                  <SelectTrigger id="send-provider">
                    <SelectValue placeholder="Auto (first active)" />
                  </SelectTrigger>
                  <SelectContent>
                    {channelProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="send-template">Template (optional)</Label>
              <Select value={sendTemplate} onValueChange={pickTemplate}>
                <SelectTrigger id="send-template">
                  <SelectValue placeholder="Adhoc message" />
                </SelectTrigger>
                <SelectContent>
                  {initialTemplates
                    .filter((t) => t.channel === sendChannel)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {sendChannel === "email" && (
              <div className="grid gap-1.5">
                <Label htmlFor="send-subject">Subject</Label>
                <Input
                  id="send-subject"
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  placeholder="Diwali offer inside"
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="send-to">Recipients (comma or line separated, max 50)</Label>
              <Textarea
                id="send-to"
                rows={2}
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="+919876543210"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="send-body">Message (supports {`{{name}}`} variables)</Label>
              <Textarea
                id="send-body"
                rows={4}
                value={sendBody}
                onChange={(e) => setSendBody(e.target.value)}
              />
            </div>
            <Button disabled={busy} onClick={() => void send()}>
              <Icons.send className="size-4" aria-hidden />
              Send now
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New template</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
            >
              <FieldGroup>
                <form.AppField
                  name="channel"
                  children={(field) => (
                    <field.SelectField
                      label="Channel"
                      options={["whatsapp", "sms", "email"].map((c) => ({
                        value: c,
                        label: c,
                      }))}
                    />
                  )}
                />
                <form.AppField
                  name="name"
                  children={(field) => <field.TextField label="Name" required />}
                />
                <form.AppField
                  name="subject"
                  children={(field) => <field.TextField label="Subject (email)" />}
                />
                <form.AppField
                  name="body"
                  children={(field) => <field.TextareaField label="Body" required rows={4} />}
                />
              </FieldGroup>
              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(submitting) => (
                  <Button type="submit" disabled={busy || submitting} className="mt-4">
                    <Icons.add className="size-4" aria-hidden />
                    Save template
                  </Button>
                )}
              </form.Subscribe>
            </form>
            <div className="mt-4 space-y-2">
              {initialTemplates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <Badge variant="secondary" className="capitalize">
                    {t.channel}
                  </Badge>
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t.variables.join(", ")}
                  </span>
                </div>
              ))}
              {initialTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground">No templates yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send log</CardTitle>
        </CardHeader>
        <CardContent>
          {initialOutbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {initialOutbox.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2"
                >
                  <Badge
                    variant={
                      m.status === "sent"
                        ? "default"
                        : m.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                    className="capitalize"
                  >
                    {m.status}
                  </Badge>
                  <span className="capitalize text-muted-foreground">{m.channel}</span>
                  <span className="font-medium">{m.to}</span>
                  {m.error && <span className="text-xs text-destructive">{m.error}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
