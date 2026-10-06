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
import { cn } from "@pixa/ui/lib/utils";

function planDetailRows(plan: Plan): { label: string; value: string }[] {
  const outletText =
    plan.id === "starter"
      ? "Multi-outlet ready"
      : plan.id === "growth"
        ? "Multi-outlet ready"
        : "Unlimited outlets";

  return [
    { label: "Platform", value: "Any device / PWA" },
    { label: "Outlet access", value: outletText },
    { label: "Ordering", value: "QR, kiosk, website + captain & rider apps" },
    { label: "Workflow", value: "Table + counter + delivery + loyalty" },
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
            title={`Start with a ${TRIAL_DAYS}-day free trial and full platform access`}
            paragraph="Starter and Growth include the full pixaPOS operating system. Pricing scales with business size and support level, while the product remains feature-complete for every restaurant team."
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
                  "cursor-pointer rounded-full px-5 py-2 font-medium capitalize transition-all duration-300",
                  cycle === c
                    ? "bg-[#138AF2] text-white shadow-[0_10px_25px_rgba(19,138,242,0.25)]"
                    : "bg-[#F4F7FB] text-slate-700 hover:bg-[#138AF2] hover:text-white dark:bg-dark-2 dark:text-white",
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
            const detailRows = planDetailRows(plan);

            return (
              <div key={plan.id} className="w-full px-4 md:w-1/2 lg:w-1/3">
                <div
                  className={cn(
                    "animate-fade-up relative z-10 mb-10 flex h-full flex-col overflow-hidden rounded-[28px] border bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_25px_70px_rgba(19,138,242,0.12)] sm:p-8 lg:p-7 xl:p-8 dark:bg-dark-2",
                    plan.featured
                      ? "border-[#17BF71]/40 bg-gradient-to-b from-white to-[#F3FFF9] shadow-[0_25px_65px_rgba(23,191,113,0.18)]"
                      : "border-slate-200",
                  )}
                  style={{ animationDelay: `${plans.indexOf(plan) * 90}ms` }}
                >
                  {plan.featured && (
                    <div className="absolute top-5 right-5 inline-flex items-center gap-2 rounded-full bg-[#17BF71] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                      Popular
                    </div>
                  )}

                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                      {plan.name}
                    </span>
                    <span className="rounded-full bg-[#138AF2]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#138AF2]">
                      {plan.tagline}
                    </span>
                  </div>

                  <h2 className="mb-2 flex min-h-[64px] items-end text-4xl font-semibold text-slate-900 xl:text-[42px] xl:leading-[1.21] dark:text-white">
                    {price == null ? (
                      "Custom"
                    ) : price === 0 ? (
                      <span>
                        Free{" "}
                        <span className="text-base font-normal text-slate-500 dark:text-slate-400">
                          forever
                        </span>
                      </span>
                    ) : (
                      <span>
                        <span className="text-xl font-medium">{formatINR(price).slice(0, 1)} </span>
                        <span className="-ml-1 -tracking-[2px]">{formatINR(price).slice(1)}</span>
                        <span className="text-base font-normal text-slate-500 dark:text-slate-400">
                          {" "}
                          / outlet / month
                        </span>
                      </span>
                    )}
                  </h2>
                  <p className="mb-6 min-h-[24px] text-sm text-slate-500 dark:text-slate-400">
                    {price == null
                      ? "Talk to us about volume pricing"
                      : cycle === "annual"
                        ? "billed annually"
                        : "billed monthly"}
                  </p>

                  <div className="mb-8 flex-1">
                    <ul className="space-y-2.5">
                      {detailRows.map((row) => (
                        <li
                          key={row.label}
                          className="flex items-start gap-2.5 text-base text-slate-600 dark:text-slate-300"
                        >
                          <span
                            className="mt-2 size-2 shrink-0 rounded-full bg-[#17BF71]"
                            aria-hidden
                          />
                          <span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {row.label}:
                            </span>{" "}
                            {row.value}
                          </span>
                        </li>
                      ))}
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2.5 text-base text-slate-600 dark:text-slate-300"
                        >
                          <span
                            className="mt-2 size-2 shrink-0 rounded-full bg-[#F2911B]"
                            aria-hidden
                          />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto w-full">
                    <Link
                      href={plan.ctaHref ?? signUpUrl(plan.id)}
                      className={cn(
                        "block w-full rounded-xl px-7 py-3 text-center text-base font-semibold transition duration-300",
                        plan.featured
                          ? "bg-[#17BF71] text-white shadow-[0_14px_30px_rgba(23,191,113,0.26)] hover:bg-[#12a85f]"
                          : "bg-[#138AF2] text-white hover:bg-[#0b75d9]",
                      )}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Prices in INR, exclusive of taxes. Trial lapses lock the workspace until a plan is chosen
          — your data is never deleted.
        </p>
      </div>
    </section>
  );
}
