"use client";

import Link from "next/link";
import { useState } from "react";
import { signUpUrl } from "@/lib/site/site";
import { PLANS, TRIAL_DAYS, formatINR, planPrice, type BillingCycle } from "@/lib/site/plans";
import SectionTitle from "@/components/site/section-title";
import { cn } from "@pixa/ui/lib/utils";

export default function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>("annual");

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
            paragraph="Trial includes every Growth feature with no credit card. Annual billing saves 20% — honest math, per outlet like Zoho."
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
                {c === "annual" && " −20%"}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-4 flex flex-wrap justify-center">
          {PLANS.map((plan) => {
            const price = planPrice(plan, cycle);
            return (
              <div key={plan.id} className="w-full px-4 md:w-1/2 lg:w-1/3">
                <div className="relative z-10 mb-10 flex h-[calc(100%-2.5rem)] flex-col overflow-hidden rounded-xl bg-white px-8 py-10 shadow-[0px_0px_40px_0px_rgba(0,0,0,0.08)] sm:p-12 lg:px-6 lg:py-10 xl:p-14 dark:bg-dark-2">
                  {plan.featured && (
                    <p className="absolute top-[60px] -right-[50px] inline-block -rotate-90 rounded-tl-md rounded-bl-md bg-primary px-5 py-2 text-base font-medium text-white">
                      Recommended
                    </p>
                  )}
                  <span className="mb-5 block text-xl font-medium text-dark dark:text-white">
                    {plan.name}
                  </span>
                  {/* min-h keeps the Features heading aligned across cards:
                      Custom/Free render one line, paid prices wrap to two. */}
                  <h2 className="mb-11 flex min-h-[104px] flex-col justify-center text-4xl font-semibold text-dark xl:text-[42px] xl:leading-[1.21] dark:text-white">
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
                          / outlet / month{cycle === "annual" ? ", billed annually" : ""}
                        </span>
                      </span>
                    )}
                  </h2>

                  <div className="mb-[50px] flex-1">
                    <h3 className="mb-5 text-lg font-medium text-dark dark:text-white">Features</h3>
                    <div className="mb-10">
                      <p className="mb-3 text-base text-body-color dark:text-dark-6">
                        {plan.tagline}
                      </p>
                      {plan.features.map((f) => (
                        <p key={f} className="mb-1 text-base text-body-color dark:text-dark-6">
                          {f}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="w-full">
                    <Link
                      href={plan.ctaHref ?? signUpUrl(plan.id)}
                      className="inline-block cursor-pointer rounded-md bg-primary px-7 py-3 text-center text-base font-medium text-white transition duration-300 hover:bg-primary/90"
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
