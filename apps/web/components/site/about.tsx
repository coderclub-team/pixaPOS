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
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-2xl" data-reveal>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Why teams switch
            </p>
            <h2 className="mb-5 text-3xl leading-tight font-bold text-dark sm:text-[40px] sm:leading-[1.15] dark:text-white">
              Built for fast-moving restaurants, cafés, and multi-outlet groups.
            </h2>
            <p className="text-base leading-relaxed text-body-color dark:text-dark-6">
              pixaPOS helps restaurant teams manage billing, kitchen, stock, delivery, and outlet
              operations from one modern PWA platform built for Indian food businesses and
              multi-store growth.
            </p>
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
