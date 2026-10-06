import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/site/footer";
import Navbar from "@/components/site/navbar";
import { signUpUrl } from "@/lib/site/site";

export const metadata: Metadata = {
  title: "Restaurant POS Solutions",
  description:
    "Explore pixaPOS solutions for restaurants, cafes, QSRs, retail stores, and cloud kitchens with one operating system for every outlet.",
  keywords: [
    "restaurant pos solutions",
    "cafe pos software",
    "qsr pos software",
    "retail pos software",
    "multi outlet restaurant software",
  ],
};

const solutionCards = [
  {
    title: "Restaurant POS software",
    description:
      "Run table service, kitchen tickets, inventory, loyalty, and online ordering from the same smart restaurant operating system.",
    href: "/solutions/restaurant-pos-software",
    image:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Cafe POS software",
    description:
      "Speed up billing and increase repeat visits with fast ordering, loyalty modules, and easy mobile-first operations.",
    href: "/solutions/cafe-pos-software",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "QSR POS software",
    description:
      "Handle rush-hour volume, self-ordering, delivery integration, and a clean kitchen ticket flow without bottlenecks.",
    href: "/solutions/qsr-pos-software",
    image:
      "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Retail POS software",
    description:
      "Manage inventory, price changes, barcode scanning, and sales reporting from a single retail-friendly dashboard.",
    href: "/solutions/retail-pos-software",
    image:
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function SolutionsPage() {
  return (
    <main className="site-theme bg-white text-slate-900 dark:bg-dark dark:text-white">
      <Navbar />

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(19,138,242,0.18),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_35%,#0f172a_100%)] pt-32 pb-20 md:pt-40">
        <div className="container">
          <div className="mx-auto max-w-4xl text-center" data-reveal>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
              Built for real business workflows
            </p>
            <h1 className="mb-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              One POS platform for every type of food and retail business.
            </h1>
            <p className="mx-auto max-w-3xl text-lg leading-8 text-slate-200">
              From single-outlet restaurants to multi-brand groups, pixaPOS helps teams run service,
              billing, room checks, ordering, and inventory from a single operating layer.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href={signUpUrl()}
                className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Book a demo
              </Link>
              <Link
                href="/#pricing"
                className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Explore pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 dark:bg-dark-2">
        <div className="container">
          <div className="grid gap-6 lg:grid-cols-2">
            {solutionCards.map((solution) => (
              <Link
                key={solution.title}
                href={solution.href}
                className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-900"
              >
                <img
                  src={solution.image}
                  alt={solution.title}
                  className="h-64 w-full object-cover"
                />
                <div className="p-7">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#138AF2]">
                    Solution
                  </p>
                  <h2 className="mb-3 text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white">
                    {solution.title}
                  </h2>
                  <p className="text-base leading-7 text-slate-600 dark:text-slate-300">
                    {solution.description}
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 text-base font-semibold text-[#138AF2]">
                    Learn more
                    <span aria-hidden>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-dark">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div data-reveal>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#17BF71]">
                Why operators switch
              </p>
              <h2 className="mb-5 text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
                One stack for every outlet, every channel, and every team.
              </h2>
              <p className="max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                pixaPOS connects billing, kitchen, orders, stock, and customer retention in one
                layer, so your team works faster and your data stays consistent across every
                touchpoint.
              </p>
            </div>
            <div className="grid gap-4" data-reveal>
              {[
                "Multi-outlet reporting with one source of truth",
                "Offline-ready POS and kitchen routing",
                "QR ordering, website ordering, and kiosk sales",
                "Loyalty, discounts, and customer retention built in",
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
        </div>
      </section>

      <Footer />
    </main>
  );
}
