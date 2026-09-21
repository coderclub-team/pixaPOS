"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR } from "@/lib/money";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";
import {
  BILLING_GST_PERCENT,
  BILLING_PLAN,
  type SubscriptionStatus,
  type SubscriptionView,
} from "../api/types";
import { cancelSubscription, ensureSubscription } from "../api/service";
import { billingKeys, invoicesQueryOptions } from "../api/queries";
import { openRazorpaySubscriptionCheckout } from "../checkout";

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  trialing: "text-sky-600",
  active: "text-emerald-700",
  grace: "animate-pulse text-amber-600",
  blocked: "text-red-600",
  cancelled: "text-muted-foreground",
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Trial",
  active: "Active",
  grace: "Grace period",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

const INVOICE_STYLE: Record<string, string> = {
  paid: "text-emerald-700",
  pending: "text-amber-600",
  failed: "text-red-600",
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function invalidate(outletId: string) {
  const qc = getQueryClient();
  qc.invalidateQueries({ queryKey: billingKeys.subscription(outletId) });
  qc.invalidateQueries({ queryKey: billingKeys.invoices(outletId) });
}

export default function BillingView({
  outletId,
  outletName,
  orgCreatedAt,
}: {
  outletId: string;
  outletName: string;
  /** Clerk org createdAt (ms) — anchors the trial clock; else local first-seen. */
  orgCreatedAt?: number;
}) {
  const trialAnchor = orgCreatedAt ? new Date(orgCreatedAt).toISOString() : undefined;

  const subQuery = useQuery({
    queryKey: billingKeys.subscription(outletId),
    queryFn: async () => {
      const { getSubscription } = await import("../api/service");
      const existing = await getSubscription(outletId);
      if (existing) return existing;
      return ensureSubscription(outletId, trialAnchor);
    },
  });
  const { data: invoices } = useQuery({
    ...invoicesQueryOptions(outletId),
    enabled: !!subQuery.data,
  });

  const sub: SubscriptionView | null = subQuery.data ?? null;

  const cancelMut = useMutation({
    mutationFn: () => cancelSubscription(outletId, { atPeriodEnd: true }),
    onSuccess: () => {
      invalidate(outletId);
      setCancelOpen(false);
      toast.success("Subscription will cancel at the period end");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [paying, setPaying] = React.useState(false);

  const subscribe = async () => {
    if (!sub) return;
    setPaying(true);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          start_at_unix:
            sub.status === "trialing"
              ? Math.floor(new Date(sub.trial_ends_at).getTime() / 1000)
              : undefined,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        error?: string;
        subscription_id?: string;
        key_id?: string;
      };
      if (!body.ok || !body.subscription_id || !body.key_id) {
        throw new Error(body.error ?? "Subscribe failed");
      }
      await openRazorpaySubscriptionCheckout({
        key_id: body.key_id,
        subscription_id: body.subscription_id,
        name: "pixaPOS",
        description: `${BILLING_PLAN.name} — ${outletName}`,
        onSuccess: () => {
          invalidate(outletId);
          toast.success("Payment authorized — subscription activating");
        },
        onDismiss: () => toast("Checkout closed — no charge made"),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Subscribe failed");
    } finally {
      setPaying(false);
    }
  };

  if (subQuery.isPending || !sub) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading billing…
        </CardContent>
      </Card>
    );
  }

  const showSubscribe = ["trialing", "grace", "blocked"].includes(sub.status);
  const cancelPending = sub.subscription.cancel_at_period_end && sub.status !== "cancelled";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Status banner — trial countdown, grace warning, blocked notice */}
      {sub.status !== "active" && (
        <Card
          className={cn(
            sub.status === "blocked" && "border-destructive/40",
            sub.status === "grace" && "border-amber-500/50",
          )}
        >
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <Icons.info className={cn("size-5", STATUS_STYLE[sub.status])} />
            <div className="min-w-0 flex-1">
              {sub.status === "trialing" && (
                <p className="text-sm">
                  <span className="font-medium">
                    Trial — {sub.days_left} day{sub.days_left === 1 ? "" : "s"} left
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    (ends {fmtDate(sub.trial_ends_at)}).
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    Subscribe to keep billing uninterrupted.
                  </span>
                </p>
              )}
              {sub.status === "grace" && (
                <p className="text-sm">
                  <span className="font-medium">
                    Trial ended — {sub.days_left} day{sub.days_left === 1 ? "" : "s"} of grace left.
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    Subscribe now to avoid interruption.
                  </span>
                </p>
              )}
              {sub.status === "blocked" && (
                <p className="text-sm">
                  <span className="font-medium">Subscription blocked.</span>
                  <span className="text-muted-foreground">
                    {" "}
                    The outlet is read-only until you subscribe.
                  </span>
                </p>
              )}
              {sub.status === "cancelled" && (
                <p className="text-sm text-muted-foreground">
                  Subscription cancelled. Resubscribe anytime to reactivate.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan card */}
      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{BILLING_PLAN.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatINR(BILLING_PLAN.amount_paise)}/outlet/month + {BILLING_GST_PERCENT}% GST
              </p>
            </div>
            <span className={cn("text-xs font-medium capitalize", STATUS_STYLE[sub.status])}>
              {STATUS_LABEL[sub.status]}
              {cancelPending ? " · cancels at period end" : ""}
            </span>
          </div>
          <ul className="grid gap-1.5 text-sm md:grid-cols-2">
            {BILLING_PLAN.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Icons.check className="size-4 shrink-0 text-emerald-600" /> {f}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-sm">
            <span className="text-muted-foreground">
              {sub.status === "active" && sub.subscription.current_period_end
                ? `Renews ${fmtDate(sub.subscription.current_period_end)}`
                : `Trial ends ${fmtDate(sub.trial_ends_at)}`}
            </span>
            <span className="ml-auto flex gap-2">
              {showSubscribe && (
                <Button size="sm" onClick={subscribe} disabled={paying}>
                  {paying ? "Opening…" : sub.status === "trialing" ? "Subscribe now" : "Subscribe"}
                </Button>
              )}
              {sub.status === "active" && !cancelPending && (
                <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                  Cancel subscription
                </Button>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payment method */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Icons.creditCard className="size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Payment method</p>
            <p className="text-xs text-muted-foreground">
              {sub.subscription.razorpay_subscription_id
                ? `Razorpay subscription ${sub.subscription.razorpay_subscription_id} · UPI Autopay / cards`
                : "No payment method yet — subscribing opens Razorpay Checkout (UPI, cards)."}
            </p>
          </div>
          {sub.subscription.razorpay_subscription_id && (
            <span className="text-xs text-muted-foreground">
              Managed via Razorpay · auto-charged monthly
            </span>
          )}
        </CardContent>
      </Card>

      {/* Billing history */}
      <Card>
        <CardContent className="p-0">
          <p className="px-4 pt-4 font-medium">Billing history</p>
          {!invoices?.length ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No invoices yet — they appear here after the first charge.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <span className="font-medium">{inv.invoice_number}</span>
                      <div className="text-xs text-muted-foreground">{fmtDate(inv.created_at)}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(inv.period_start)} – {fmtDate(inv.period_end)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{formatINR(inv.total_paise)}</span>
                      <div className="text-xs text-muted-foreground">
                        incl. {formatINR(inv.gst_paise)} GST
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn("text-xs font-medium capitalize", INVOICE_STYLE[inv.status])}
                      >
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {inv.razorpay_invoice_id ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cancel confirm */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              The outlet stays usable until the paid period ends
              {sub.subscription.current_period_end
                ? ` (${fmtDate(sub.subscription.current_period_end)})`
                : ""}
              , then moves to read-only. You can resubscribe anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep subscription
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
            >
              Cancel subscription
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
