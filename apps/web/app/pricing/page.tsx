import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/site/footer";
import Navbar from "@/components/site/navbar";
import Pricing from "@/components/site/pricing";
import { getMarketingPlans } from "@/lib/site/plans-server";

export const metadata: Metadata = {
  title: "Pricing for restaurant POS software",
  description:
    "Transparent pricing for pixaPOS restaurant POS software. Compare Starter, Growth, and Custom plans for Indian restaurants, cafes, and multi-outlet brands.",
  keywords: [
    "restaurant pos pricing",
    "pos software cost india",
    "restaurant software pricing",
    "pixaPOS plans",
  ],
};

export default async function PricingPage() {
  const plans = await getMarketingPlans();

  return (
    <main className="site-theme bg-white text-slate-900 dark:bg-dark dark:text-white">
      <Navbar />

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(19,138,242,0.18),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_35%,#0f172a_100%)] pt-32 pb-20 md:pt-40">
        <div className="container">
          <div className="mx-auto max-w-4xl text-center" data-reveal>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
              Pricing
            </p>
            <h1 className="mb-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              Simple pricing built for restaurants that want to grow.
            </h1>
            <p className="mx-auto max-w-3xl text-lg leading-8 text-slate-200">
              Start with a full-feature trial, then choose the plan that fits your outlet count,
              workflow needs, and operational complexity.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href="/contact"
                className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Pricing plans={plans} />

      <section className="bg-slate-50 py-20 dark:bg-dark-2">
        <div className="container max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "No surprise feature gates",
                description:
                  "Starter and Growth include the full pixaPOS operating system, so teams do not need to pay for a basic version before they can grow.",
              },
              {
                title: "Built for multi-outlet growth",
                description:
                  "The pricing model is designed for restaurants that expand from one outlet to several without reworking the foundation.",
              },
              {
                title: "Custom fit for chains and franchises",
                description:
                  "Custom plans are for advanced workflows, partner integrations, deeper governance, and larger-scale franchise or group operations.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_25px_60px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
                data-reveal
              >
                <h3 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-base leading-7 text-slate-600 dark:text-slate-300">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
