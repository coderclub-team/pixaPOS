"use client";

import { useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { REWARD_RULES } from "@/features/rewards/api/types";
import { rewardsOutstandingQueryOptions } from "@/features/rewards/api/queries";

export default function RewardsPage() {
  const { data, isPending } = useQuery(rewardsOutstandingQueryOptions());

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
            <CardDescription>Fixed for now — per-outlet configuration lands next.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p>
              Earn <strong>1 pt per ₹{REWARD_RULES.earn_paise_per_point / 100}</strong> on completed
              bills (linked customers only, one earn per order).
            </p>
            <p>
              Tender at <strong>1 pt = ₹{REWARD_RULES.redeem_paise_per_point / 100}</strong> from
              the bill discount dialog — needs a linked customer with balance.
            </p>
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
