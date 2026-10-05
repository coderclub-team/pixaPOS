"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";

const LIFECYCLES = ["trial", "active", "past_due", "suspended", "churned"];

export function OrgActions({
  id,
  profile,
  plans,
}: {
  id: string;
  profile: { lifecycle: string | null; plan: string | null } | null;
  plans: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(profile?.plan ?? "starter");
  const [lifecycle, setLifecycle] = useState(profile?.lifecycle ?? "trial");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [suspendOpen, setSuspendOpen] = useState(false);

  const save = async (patch: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
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
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor="org-lifecycle">Lifecycle</Label>
        <Select value={lifecycle} disabled={busy} onValueChange={setLifecycle}>
          <SelectTrigger id="org-lifecycle" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIFECYCLES.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="org-plan">Plan</Label>
        <Select value={plan} disabled={busy} onValueChange={setPlan}>
          <SelectTrigger id="org-plan" className="w-36">
            <SelectValue placeholder="Select plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        disabled={busy}
        onClick={() => void save({ lifecycle, plan }, "Organisation updated")}
        className="self-end"
      >
        {busy ? "Saving…" : "Save"}
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => setSuspendOpen(true)}
        className="self-end text-destructive hover:text-destructive"
      >
        Suspend
      </Button>

      <Dialog open={suspendOpen} onOpenChange={(v) => !v && setSuspendOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend this organisation?</DialogTitle>
            <DialogDescription>
              Billing stops and access is blocked immediately. Enter your password to confirm — this
              is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="suspend-confirm">Your password</Label>
            <Input
              id="suspend-confirm"
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
                void save(
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
    </div>
  );
}
