"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Badge } from "@pixa/ui/base-ui/badge";
import type { PrintJob } from "../api/types";
import { retryFailedJobs } from "../api/service";
import { printKeys } from "../api/queries";
import { toast } from "sonner";

const STATUS_STYLE: Record<PrintJob["status"], string> = {
  QUEUED: "border-amber-500 text-amber-600",
  SENT: "border-green-500 text-green-600",
  FAILED: "border-destructive text-destructive",
};

/** Print job history with manual retry for queued/failed jobs. */
export default function PrintHistory({ jobs }: { jobs: PrintJob[] }) {
  const queryClient = useQueryClient();
  const retryMut = useMutation({
    mutationFn: () => retryFailedJobs(),
    onSuccess: (sent) => {
      queryClient.invalidateQueries({ queryKey: printKeys.all });
      toast.success(sent > 0 ? `${sent} job(s) sent` : "Nothing pending");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = jobs.filter((j) => j.status === "QUEUED" || j.status === "FAILED").length;

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No print jobs yet. Fire a KOT or complete an order with auto-print on.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {pending > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => retryMut.mutate()} disabled={retryMut.isPending}>
            Retry {pending} pending
          </Button>
        </div>
      )}
      {jobs.map((j) => (
        <div key={j.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {j.purpose} · {j.ref_id.slice(0, 12)}
              </span>
              <Badge variant="outline" className={STATUS_STYLE[j.status]}>
                {j.status.toLowerCase()}
              </Badge>
              {j.is_reprint && <Badge variant="outline">reprint</Badge>}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {new Date(j.created_at).toLocaleString("en-IN")}
              {j.reprint_reason ? ` · ${j.reprint_reason}` : ""}
              {j.last_error ? ` · ${j.last_error}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
