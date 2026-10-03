"use client";

import Link from "next/link";
import { useState } from "react";
import { signUpUrl } from "@/lib/site";
import { PLANS, TRIAL_DAYS, formatINR, planPrice, type BillingCycle } from "@/lib/plans";
import { Icons } from "@pixa/ui/icons";
import { Badge } from "@pixa/ui/base-ui/badge";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { cn } from "@pixa/ui/lib/utils";

export default function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>("annual");

  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
      <p className="text-center text-sm font-medium text-(--muted-foreground)">Pricing</p>
      <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-bold tracking-tight text-balance">
        Start with a {TRIAL_DAYS}-day free trial, pay per outlet
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-(--muted-foreground)">
        Trial includes every Growth feature, no credit card required. Annual billing saves 20% — the
        same honest math as Odoo, per outlet like Zoho.
      </p>

      <div
        className="mx-auto mt-6 flex w-fit items-center gap-1 rounded-full border border-(--border) p-1 text-sm"
        role="group"
        aria-label="Billing frequency"
      >
        {(["monthly", "annual"] as BillingCycle[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCycle(c)}
            aria-pressed={cycle === c}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium capitalize",
              cycle === c
                ? "bg-(--primary) text-(--primary-foreground)"
                : "text-(--muted-foreground)",
            )}
          >
            {c}
            {c === "annual" && <span className="ml-1 text-xs">−20%</span>}
          </button>
        ))}
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price = planPrice(plan, cycle);
          return (
            <li key={plan.id} className="h-full">
              <Card className={cn("h-full", plan.featured && "border-2 border-(--primary)")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {plan.name}
                    {plan.featured && <Badge>Most popular</Badge>}
                  </CardTitle>
                  <CardDescription>{plan.tagline}</CardDescription>
                  <p className="pt-2">
                    {price == null ? (
                      <span className="text-3xl font-bold">Custom</span>
                    ) : (
                      <span>
                        <span className="text-3xl font-bold">{formatINR(price)}</span>
                        <span className="text-sm text-(--muted-foreground)">
                          {" "}
                          / outlet / month
                          {cycle === "annual" ? ", billed annually" : ", billed monthly"}
                        </span>
                      </span>
                    )}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <ul className="grid gap-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Icons.check className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={signUpUrl(plan.id)}
                    className={cn(
                      buttonVariants({ variant: plan.featured ? "default" : "outline" }),
                      "w-full",
                    )}
                  >
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-center text-xs text-(--muted-foreground)">
        Prices in INR, exclusive of taxes. Trial lapses lock the workspace until a plan is chosen —
        your data is never deleted.
      </p>
    </section>
  );
}
