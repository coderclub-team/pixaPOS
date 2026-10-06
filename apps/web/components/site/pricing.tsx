"use client";

import Link from "next/link";
import { useState } from "react";
import { signUpUrl } from "@/lib/site/site";
import {
  PLANS,
  TRIAL_DAYS,
  formatINR,
  planPrice,
  type BillingCycle,
  type Plan,
} from "@/lib/site/plans";
import SectionTitle from "@/components/site/section-title";
import type { LimitMap } from "@pixa/db/plans";
import { formatBytes } from "@/lib/usage-types";
import { cn } from "@pixa/ui/lib/utils";

function limitRows(l: LimitMap, bestFor: string): { label: string; value: string }[] {
  const num = (v: number | null) => (v === null ? "Custom" : v.toLocaleString("en-IN"));
  const storage = formatBytes((l.databaseStorage ?? 0) + (l.objectStorage ?? 0));
  return [
    { label: "Orders / month", value: num(l.orders) },
    { label: "Products", value: num(l.products) },
    { label: "Customers", value: num(l.customers) },
    { label: "Storage", value: storage },
    { label: "Best for", value: bestFor },
  ];
}

export default function Pricing({ plans = PLANS }: { plans?: Plan[] }) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <section
      id="pricing"
      className="relative z-20 overflow-hidden bg-white pt-20 pb-12 lg:pt-[120px] lg:pb-[90px] dark:bg-dark"
    >
      <div className="container">
        <div className="mb-[60px]">
          <SectionTitle
            subtitle="Pricing Table"
            title={`Start with a ${TRIAL_DAYS}-day free trial, pay per outlet`}
            paragraph="Trial includes every Growth feature with no credit card. Bill monthly, or annually and save 25% — honest math, per-outlet pricing."
            center
          />
          <div className="mt-6 flex justify-center gap-3 text-base">
            {(["monthly", "annual"] as BillingCycle[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                aria-pressed={cycle === c}
                className={cn(
                  "cursor-pointer rounded-md px-5 py-2 font-medium capitalize duration-300",
                  cycle === c
                    ? "bg-primary text-white"
                    : "bg-gray-2 text-dark hover:bg-primary hover:text-white dark:bg-dark-2 dark:text-white",
                )}
              >
                {c}
                {c === "annual" && " −25%"}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-4 flex flex-wrap items-stretch justify-center">
          {plans.map((plan) => {
            const price = planPrice(plan, cycle);
            return (
              <div key={plan.id} className="w-full px-4 md:w-1/2 lg:w-1/3">
                <div className="relative z-10 mb-10 flex h-[calc(100%-2.5rem)] flex-col overflow-hidden rounded-xl bg-white px-8 py-10 shadow-[0px_0px_40px_0px_rgba(0,0,0,0.08)] sm:p-12 lg:px-6 lg:py-10 xl:p-14 dark:bg-dark-2">
                  {plan.featured && (
                    <p className="absolute top-[60px] -right-[50px] inline-block -rotate-90 rounded-tl-md rounded-bl-md bg-primary px-5 py-2 text-base font-medium text-white">
                      Recommended
                    </p>
                  )}

                  <span className="mb-3 block text-xl font-medium text-dark dark:text-white">
                    {plan.name}
                  </span>

                  <h2 className="mb-2 flex min-h-[64px] items-end text-4xl font-semibold text-dark xl:text-[42px] xl:leading-[1.21] dark:text-white">
                    {price == null ? (
                      "Custom"
                    ) : price === 0 ? (
                      <span>
                        Free{" "}
                        <span className="text-base font-normal text-body-color dark:text-dark-6">
                          forever
                        </span>
                      </span>
                    ) : (
                      <span>
                        <span className="text-xl font-medium">{formatINR(price).slice(0, 1)} </span>
                        <span className="-ml-1 -tracking-[2px]">{formatINR(price).slice(1)}</span>
                        <span className="text-base font-normal text-body-color dark:text-dark-6">
                          {" "}
                          / outlet / month
                        </span>
                      </span>
                    )}
                  </h2>
                  <p className="mb-6 min-h-[24px] text-sm text-body-color dark:text-dark-6">
                    {price == null
                      ? "Talk to us about volume pricing"
                      : cycle === "annual"
                        ? "billed annually"
                        : "billed monthly"}
                  </p>

                  {plan.limits && (
                    <div className="mb-6 rounded-lg border border-gray-2 p-4 dark:border-dark-3">
                      <h3 className="mb-3 text-xs font-semibold tracking-wide text-body-color uppercase dark:text-dark-6">
                        Usage limits
                      </h3>
                      <dl className="space-y-2 text-sm">
                        {limitRows(plan.limits, plan.tagline).map((row) => (
                          <div
                            key={row.label}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <dt className="text-body-color dark:text-dark-6">{row.label}</dt>
                            <dd className="font-medium tabular-nums text-dark dark:text-white">
                              {row.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  <div className="mb-8 flex-1">
                    <ul className="space-y-2">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-base text-body-color dark:text-dark-6"
                        >
                          <span
                            className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                            aria-hidden
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto w-full">
                    <Link
                      href={plan.ctaHref ?? signUpUrl(plan.id)}
                      className="block w-full cursor-pointer rounded-md bg-primary px-7 py-3 text-center text-base font-medium text-white transition duration-300 hover:bg-primary/90"
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-center text-sm text-body-color dark:text-dark-6">
          Prices in INR, exclusive of taxes. Trial lapses lock the workspace until a plan is chosen
          — your data is never deleted.
        </p>
      </div>
    </section>
  );
}
