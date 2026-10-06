import Link from "next/link";
import { signUpUrl } from "@/lib/site/site";

const FEATURES = [
  {
    title: "PWA POS across devices",
    description:
      "Run the same restaurant workflow from browser, tablet, Android, desktop, or staff kiosk with no device lock-in.",
  },
  {
    title: "Multi-outlet control",
    description:
      "Manage all outlets from one workspace with central menus, shared pricing, roles, and branch-level reporting.",
  },
  {
    title: "KOT & KDS flow",
    description:
      "Route dine-in, takeaway, delivery, and counter service instantly to the correct kitchen station without delays.",
  },
  {
    title: "Inventory & wastage",
    description:
      "Track stock, purchase orders, recipes, stock movement, and wastage from a single operational view.",
  },
  {
    title: "CRM & loyalty",
    description:
      "Capture customer details, repeat-orders, promos, and loyalty activity in one connected system.",
  },
  {
    title: "Owner dashboards",
    description:
      "See item sales, payment trends, outlet performance, and business health across every location in real time.",
  },
];

export default function About() {
  return (
    <section id="about" className="bg-gray-1 pt-12 pb-6 lg:pt-[70px] lg:pb-[40px] dark:bg-dark-2">
      <div className="container">
        <div className="mx-auto w-full max-w-none">
          <div className="mb-8 max-w-3xl" data-reveal>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Why teams switch
            </p>
            <h2 className="mb-5 text-3xl leading-tight font-bold text-dark sm:text-[40px] sm:leading-[1.15] dark:text-white">
              Built for fast-moving restaurants, cafés, and multi-outlet groups.
            </h2>
            <p className="text-base leading-relaxed text-body-color dark:text-dark-6">
              pixaPOS helps restaurant operators run billing, menu, kitchen, order flow, stock, and
              customer experience from one connected system without juggling different apps for each
              outlet.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="pixaPOS key strengths">
              {[
                { value: "1 system", label: "for billing, KOT, KDS, and stock" },
                { value: "5x faster", label: "staff coordination during peak hours" },
                { value: "100%", label: "PWA access across phone, tablet, and desktop" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="text-2xl font-black text-primary">{stat.value}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]" data-reveal>
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Designed for real restaurant operations
              </p>
              <h3 className="mb-4 text-2xl font-bold text-dark dark:text-white">
                One platform for service, stock, and growth.
              </h3>
              <p className="mb-5 text-base leading-7 text-body-color dark:text-dark-6">
                From front-of-house billing to KOT and KDS coordination, pixaPOS keeps every order,
                table, kitchen ticket, promotion, and customer touchpoint connected. It is designed
                for busy Indian food businesses that need speed, visibility, and fewer manual errors
                across every shift.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Operations
                  </p>
                  <p className="mt-2 text-lg font-bold text-dark dark:text-white">
                    Table, takeaway, delivery
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Visibility
                  </p>
                  <p className="mt-2 text-lg font-bold text-dark dark:text-white">
                    Live outlet reporting
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-950 p-7 text-white shadow-[0_25px_50px_rgba(15,23,42,0.18)]">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">
                Why operators stay
              </p>
              <ul className="space-y-4 text-base text-slate-200">
                <li className="flex gap-3">
                  <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs text-sky-300">
                    ✓
                  </span>
                  Faster service with better kitchen coordination.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs text-sky-300">
                    ✓
                  </span>
                  One menu and pricing structure across every outlet.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs text-sky-300">
                    ✓
                  </span>
                  Better customer retention with loyalty, coupons, and feedback.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs text-sky-300">
                    ✓
                  </span>
                  Flexible PWA access across phones, tablets, and desktops.
                </li>
              </ul>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-[0_20px_35px_rgba(19,138,242,0.12)] dark:border-slate-800 dark:bg-slate-900"
                data-reveal
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-xl text-primary transition-transform duration-300 hover:scale-110">
                  {feature.title.charAt(0)}
                </div>
                <h3 className="mb-3 text-xl font-bold text-dark dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-6 text-body-color dark:text-dark-6">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div
            className="mt-12 rounded-3xl bg-slate-950 p-8 text-white shadow-[0_25px_50px_rgba(15,23,42,0.18)] lg:p-10"
            data-reveal
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">
                  Local-first and ready to scale
                </p>
                <h3 className="text-2xl font-bold sm:text-3xl">
                  One restaurant operating system for dine-in, takeaway, delivery, and outlet
                  reporting.
                </h3>
              </div>
              <Link
                href={signUpUrl()}
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
