"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { useAppForm } from "@/lib/form";
import { Icons } from "@pixa/ui/icons";

type Provider = {
  id: string;
  channel: string;
  provider: string;
  displayName: string;
  config: Record<string, string>;
  isActive: boolean;
  lastTestedAt: string | Date | null;
  lastTestOk: boolean | null;
};

const FIELD_HINTS: Record<string, string> = {
  phoneNumberId: "Meta phone number ID",
  accessToken: "Permanent system-user token",
  apiUrl: "BSP endpoint override (optional)",
  authKey: "MSG91 auth key",
  senderId: "6-char sender ID",
  flowId: "Flow/template ID (optional)",
  route: "Route: 4 = transactional",
  apiKey: "API key",
  sender: "Sender name",
  accountSid: "Twilio account SID",
  authToken: "Twilio auth token",
  from: "Twilio from number",
  host: "smtp.example.com",
  port: "587 (465 = SSL)",
  user: "SMTP username",
  password: "SMTP password",
  adAccountId: "act_<id> without prefix",
  developerToken: "Google Ads developer token",
  customerId: "Customer ID, no dashes",
  clientId: "OAuth client ID",
  clientSecret: "OAuth client secret",
  refreshToken: "OAuth refresh token",
};

const providerSchema = z.object({
  channel: z.string().min(1),
  provider: z.string().min(1),
  displayName: z.string().min(1, "Display name required"),
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

const KIND_OPTIONS: {
  channel: string;
  providers: { id: string; label: string; fields: string[] }[];
}[] = [
  {
    channel: "whatsapp",
    providers: [
      { id: "meta-cloud", label: "Meta Cloud API", fields: ["phoneNumberId", "accessToken"] },
      {
        id: "bsp",
        label: "BSP (Interakt / Gupshup / WATI / AiSensy)",
        fields: ["phoneNumberId", "accessToken", "apiUrl"],
      },
    ],
  },
  {
    channel: "sms",
    providers: [
      { id: "msg91", label: "MSG91", fields: ["authKey", "senderId", "flowId", "route"] },
      { id: "textlocal", label: "TextLocal", fields: ["apiKey", "sender"] },
      { id: "twilio", label: "Twilio", fields: ["accountSid", "authToken", "from"] },
    ],
  },
  {
    channel: "email",
    providers: [
      { id: "smtp", label: "SMTP", fields: ["host", "port", "user", "password", "from"] },
    ],
  },
  {
    channel: "meta-ads",
    providers: [
      { id: "meta-marketing", label: "Meta Marketing API", fields: ["accessToken", "adAccountId"] },
    ],
  },
  {
    channel: "google-ads",
    providers: [
      {
        id: "google-ads",
        label: "Google Ads API",
        fields: ["developerToken", "customerId", "clientId", "clientSecret", "refreshToken"],
      },
    ],
  },
];

export function IntegrationsConsole({ initialProviders }: { initialProviders: Provider[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);

  const form = useAppForm({
    defaultValues: { channel: "whatsapp", provider: "meta-cloud", displayName: "" },
    validators: { onSubmit: providerSchema },
    onSubmit: async ({ value }) => {
      const kind = KIND_OPTIONS.find((k) => k.channel === value.channel);
      if (!kind?.providers.some((p) => p.id === value.provider)) {
        toast.error("Pick a provider for this channel first");
        form.setFieldValue("provider", kind?.providers[0]?.id ?? value.provider);
        return;
      }
      setBusy(true);
      try {
        await api("/api/admin/messaging/providers", "POST", {
          ...value,
          config: fieldValues,
        });
        toast.success("Provider added — now fill credentials below");
        form.reset();
        setFieldValues({});
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
  });

  async function saveCreds(p: Provider) {
    setBusy(true);
    try {
      await api("/api/admin/messaging/providers", "PATCH", { id: p.id, config: fieldValues });
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

  function editFields(p: Provider) {
    const kind = KIND_OPTIONS.find((k) => k.channel === p.channel)?.providers.find(
      (x) => x.id === p.provider,
    );
    const blank: Record<string, string> = {};
    for (const f of kind?.fields ?? Object.keys(p.config)) blank[f] = "";
    setFieldValues(blank);
    setEditing(p);
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-3">
        {initialProviders.map((p) => (
          <li key={p.id}>
            <Card className={!p.isActive ? "opacity-60" : undefined}>
              <CardContent className="flex flex-wrap items-center gap-2 pt-4">
                <div className="min-w-0">
                  <p className="font-medium">{p.displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {p.channel} · {p.provider}
                    {p.lastTestedAt
                      ? ` · tested ${new Date(p.lastTestedAt).toLocaleString("en-IN")} — ${p.lastTestOk ? "ok" : "failed"}`
                      : " · never tested"}
                  </p>
                </div>
                <span className="ml-auto flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void test(p)}>
                    Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => editFields(p)}>
                    <Icons.edit className="size-3.5" aria-hidden />
                    Credentials
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Icons.trash className="size-3.5" aria-hidden />
                  </Button>
                </span>
                {editing?.id === p.id && (
                  <div className="grid w-full gap-2 rounded-lg bg-muted p-3 sm:grid-cols-2">
                    {Object.keys(fieldValues).map((f) => (
                      <div key={f} className="grid gap-1.5">
                        <Label htmlFor={`cred-${p.id}-${f}`}>{FIELD_HINTS[f] ?? f}</Label>
                        <Input
                          id={`cred-${p.id}-${f}`}
                          type={
                            f.toLowerCase().includes("password") ||
                            f.toLowerCase().includes("token") ||
                            f.toLowerCase().includes("key")
                              ? "password"
                              : "text"
                          }
                          value={fieldValues[f]}
                          onChange={(e) => setFieldValues((v) => ({ ...v, [f]: e.target.value }))}
                          placeholder={p.config[f] === "••••••" ? "Stored (blank keeps it)" : ""}
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 sm:col-span-2">
                      <Button size="sm" disabled={busy} onClick={() => void saveCreds(p)}>
                        Save credentials
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(null);
                          setFieldValues({});
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      {initialProviders.length === 0 && (
        <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          No providers yet. Add WhatsApp, SMS, email, Meta or Google below.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add provider</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <form.AppField
                  name="channel"
                  children={(field) => (
                    <field.SelectField
                      label="Channel"
                      options={KIND_OPTIONS.map((k) => ({ value: k.channel, label: k.channel }))}
                    />
                  )}
                />
                <form.AppField
                  name="provider"
                  children={(field) => (
                    <field.SelectField
                      label="Provider"
                      options={(
                        KIND_OPTIONS.find((k) => k.channel === field.state.value)?.providers ?? []
                      ).map((p) => ({ value: p.id, label: p.label }))}
                    />
                  )}
                />
                <form.AppField
                  name="displayName"
                  children={(field) => <field.TextField label="Display name" required />}
                />
              </div>
            </FieldGroup>
            <p className="mt-2 text-xs text-muted-foreground">
              Credentials are entered after creation (never echoed back — masked as ••••••).
            </p>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={busy || submitting} className="mt-4">
                  <Icons.add className="size-4" aria-hidden />
                  Add provider
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

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
    </div>
  );
}
