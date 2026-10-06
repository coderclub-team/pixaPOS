"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Button } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { toast } from "sonner";
import {
  rewardKeys,
  rewardRulesQueryOptions,
  rewardsOutstandingQueryOptions,
} from "@/features/rewards/api/queries";
import { createRewardRules } from "@/features/rewards/api/service";
import { getQueryClient } from "@/lib/query-client";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RewardsPage() {
  const { data, isPending } = useQuery(rewardsOutstandingQueryOptions());
  const { data: rules } = useQuery(rewardRulesQueryOptions());
  const queryClient = useQueryClient();
  const [earnRs, setEarnRs] = useState("10");
  const [redeemRs, setRedeemRs] = useState("1");
  const [fromAt, setFromAt] = useState(() => toLocalInput(new Date().toISOString()));
  const [toAt, setToAt] = useState("");

  const active = (rules ?? []).find(
    (r) =>
      r.from_at <= new Date().toISOString() && (!r.to_at || new Date().toISOString() < r.to_at),
  );

  const mut = useMutation({
    mutationFn: () =>
      createRewardRules({
        earn_paise_per_point: Math.round(Number(earnRs) * 100),
        redeem_paise_per_point: Math.round(Number(redeemRs) * 100),
        from_at: fromAt ? new Date(fromAt).toISOString() : undefined,
        to_at: toAt ? new Date(toAt).toISOString() : undefined,
      }),
    onSuccess: (r) => {
      getQueryClient().invalidateQueries({ queryKey: rewardKeys.rules() });
      queryClient.invalidateQueries({ queryKey: rewardKeys.rules() });
      toast.success(`Rules live from ${new Date(r.from_at).toLocaleString()} — previous closed`);
      setToAt("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending)
    return (
      <PageContainer pageTitle="Rewards" pageDescription="Marketing — Rewards" isLoading>
        <div />
      </PageContainer>
    );

  return (
    <PageContainer
      pageTitle="Rewards"
      pageDescription="Member points — earn on completion, tender on any bill."
    >
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Members with points</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{data?.members ?? 0}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Points outstanding</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">
              {data?.points ?? 0}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                ≈ ₹{data?.points ?? 0} liability
              </span>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Program rules</CardTitle>
            <CardDescription>
              {active
                ? `Live now: 1 pt per ₹${active.earn_paise_per_point / 100} · 1 pt = ₹${active.redeem_paise_per_point / 100}${active.to_at ? ` · till ${new Date(active.to_at).toLocaleString()}` : ""}`
                : "No active rules."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Earn — ₹ per point</Label>
                <Input
                  type="number"
                  min={1}
                  value={earnRs}
                  onChange={(e) => setEarnRs(e.target.value)}
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tender — ₹ per point</Label>
                <Input
                  type="number"
                  min={0.5}
                  step="0.5"
                  value={redeemRs}
                  onChange={(e) => setRedeemRs(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Effective from (default now)</Label>
                <Input
                  type="datetime-local"
                  value={fromAt}
                  onChange={(e) => setFromAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>To (optional)</Label>
                <Input
                  type="datetime-local"
                  value={toAt}
                  onChange={(e) => setToAt(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Saving closes the previous open rules at the new from time — exactly one program is
              ever live. Bills earn/tender at the rules active when they run.
            </p>
            <div className="flex justify-end">
              <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
                {mut.isPending ? "Saving…" : "Publish rules"}
              </Button>
            </div>
            {(rules ?? []).length > 1 && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground">History</p>
                {(rules ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span>
                      1 pt / ₹{r.earn_paise_per_point / 100} · 1 pt = ₹
                      {r.redeem_paise_per_point / 100}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(r.from_at).toLocaleString()} →{" "}
                      {r.to_at ? new Date(r.to_at).toLocaleString() : "open"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-muted-foreground">
              Points, promos and manual discounts are mutually exclusive per bill (last wins);
              replaced tenders return to the member automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
