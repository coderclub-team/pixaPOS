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
import { Icons } from "@pixa/ui/icons";

export function LeadActions({ lead }: { lead: { id: string; status: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const call = async (url: string, init?: RequestInit, done?: string) => {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Action failed");
      if (done) toast.success(done);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const patch = (status: string, done: string) =>
    call(
      `/api/admin/leads/${lead.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      },
      done,
    );

  if (lead.status === "converted")
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <Icons.check className="size-3.5" aria-hidden />
        Converted to organisation
      </p>
    );
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void patch("contacted", "Marked contacted")}
      >
        Mark contacted
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void patch("trial", "Trial started")}
      >
        Start trial
      </Button>
      <Button
        size="sm"
        disabled={busy}
        onClick={() =>
          void call(
            `/api/admin/leads/${lead.id}/approve`,
            { method: "POST" },
            "Organisation created",
          )
        }
      >
        Approve → create org
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => setRejectOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        Reject
      </Button>

      <Dialog open={rejectOpen} onOpenChange={(v) => !v && setRejectOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this registration?</DialogTitle>
            <DialogDescription>
              The lead stays in the pipeline as rejected. You can re-open it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setRejectOpen(false);
                void patch("rejected", "Lead rejected");
              }}
            >
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
