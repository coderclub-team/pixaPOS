import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/site/footer";
import Navbar from "@/components/site/navbar";
import ScrollReveal from "@/components/site/scroll-reveal";
import { signUpUrl } from "@/lib/site/site";

export const metadata: Metadata = {
  title: "About pixaPOS",
  description:
    "Learn about pixaPOS, the restaurant operations platform that helps food businesses streamline billing, inventory, kitchen operations, and growth.",
  keywords: [
    "about pixaPOS",
    "restaurant pos company",
    "restaurant software india",
    "pos for food business",
  ],
};

const values = [
  {
    title: "Built for real service teams",
    description:
      "We design around actual restaurant workflows — counters, tables, KOTs, delivery, stock, and customer retention — not just generic accounting screens.",
  },
  {
    title: "Local-first reliability",
    description:
      "When internet or power is unstable, the operation still continues. Billing and kitchen workflows remain dependable, so teams can recover quickly.",
  },
  {
    title: "Simple enough for one outlet",
    description:
      "Strong enough for several branches. pixaPOS scales from single stores to multi-outlet food groups without forcing a messy migration path.",
  },
];

export default function AboutPage() {
  return (
    <main className="site-theme bg-white text-slate-900 dark:bg-dark dark:text-white">
      <ScrollReveal>
        <Navbar />

        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(19,138,242,0.18),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_35%,#0f172a_100%)] pt-32 pb-20 md:pt-40">
          <div className="container">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
              <div data-reveal>
                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
                  Our mission
                </p>
                <h1 className="mb-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                  Make busy food businesses calmer, faster, and more profitable.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-slate-200">
                  pixaPOS is built for restaurant owners, QSR operators, cafe teams, and
                  multi-outlet food brands that need one clear system to manage service, stock,
                  sales, and growth.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href={signUpUrl()}
                    className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Get started
                  </Link>
                  <Link
                    href="/solutions"
                    className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
                  >
                    Explore solutions
                  </Link>
                </div>
              </div>

              <div className="relative" data-reveal>
                <div className="absolute -inset-6 rounded-[32px] bg-[#17BF71]/15 blur-2xl" />
                <img
                  src="https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80"
                  alt="Restaurant operations and team management"
                  className="relative h-[520px] w-full rounded-[30px] border border-white/10 object-cover shadow-[0_40px_100px_rgba(15,23,42,0.4)]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-20 dark:bg-dark-2">
          <div className="container">
            <div className="mb-12 max-w-3xl" data-reveal>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#138AF2]">
                Why we exist
              </p>
              <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
                Less chaos, better service, stronger margins.
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {values.map((value, index) => (
                <article
                  key={value.title}
                  className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_25px_60px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
                  data-reveal
                  style={{ transitionDelay: `${index * 120}ms` }}
                >
                  <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#138AF2]/10 text-lg font-bold text-[#138AF2]">
                    {index + 1}
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
                    {value.title}
                  </h3>
                  <p className="text-base leading-7 text-slate-600 dark:text-slate-300">
                    {value.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 dark:bg-dark">
          <div className="container grid gap-10 lg:grid-cols-2 lg:items-center">
            <div data-reveal>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#17BF71]">
                What we believe
              </p>
              <h2 className="mb-5 text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
                The right software should help owners work with confidence.
              </h2>
              <p className="max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                We believe teams deserve software that is simple to learn, fast during service,
                transparent in reporting, and dependable even when the power or internet drops. That
                is why pixaPOS is built to feel like an operating tool, not a complicated admin app.
              </p>
            </div>

            <div className="grid gap-4" data-reveal>
              {[
                "Simple operations for owners and staff",
                "Built for Indian food businesses and multi-outlet growth",
                "PWA-first access across phones, tablets, and desktops",
                "Operational visibility without extra complexity",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#17BF71]/12 text-[#17BF71]">
                    ✓
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Footer />
      </ScrollReveal>
    </main>
  );
}
