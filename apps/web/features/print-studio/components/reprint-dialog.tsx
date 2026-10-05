"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Icons } from "@pixa/ui/icons";
import { reprintDoc } from "../api/service";
import { printKeys } from "../api/queries";
import { eventKeys } from "@/features/events/api/queries";
import { toast } from "sonner";

/** Reprint with mandatory reason (audited BILL_REPRINTED / KOT_REPRINTED). */
export default function ReprintDialog({
  purpose,
  refId,
  refLabel,
  triggerLabel,
}: {
  purpose: "BILL" | "KOT";
  refId: string;
  refLabel: string;
  triggerLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: () => reprintDoc(purpose, refId, reason),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: printKeys.all });
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
      setOpen(false);
      setReason("");
      if (job.status === "SENT") toast.success(`${refLabel} reprint sent`);
      else toast.error(job.last_error ?? "Reprint queued — printer unreachable, see history");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-2 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={`Reprint ${refLabel}`}
      >
        <Icons.refresh className="size-4" />
        {triggerLabel ?? "Reprint"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Reprint {refLabel}</DialogTitle>
            <DialogDescription>
              A duplicate {purpose === "BILL" ? "bill" : "KOT"} prints with a DUPLICATE stamp. The
              reprint is audited — a reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`reprint-reason-${refId}`}>Reason</Label>
            <Input
              id={`reprint-reason-${refId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. customer lost the original"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!reason.trim() || mut.isPending} onClick={() => mut.mutate()}>
              {mut.isPending ? "Printing…" : "Print duplicate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
