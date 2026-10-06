import Link from "next/link";
import Footer from "@/components/site/footer";
import Navbar from "@/components/site/navbar";
import { signUpUrl } from "@/lib/site/site";

const featureHighlights = [
  {
    title: "Multi-outlet operations",
    description:
      "Run every branch from one command center with unified menus, stock visibility, pricing control, and performance reporting.",
    image:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Order flow built for restaurants",
    description:
      "Move seamlessly from QR tables to kiosk ordering, delivery flows, captain apps, and kitchen dispatch without gaps in the workflow.",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Inventory that stays accurate",
    description:
      "Track recipes, batches, wastage, stock movements, and purchase flows with full traceability for operational control.",
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
  },
];

const capabilityRows = [
  "QR ordering from table",
  "Self-ordering kiosk",
  "Free restaurant website ordering",
  "Captain app and rider app",
  "Customer loyalty, discounts & coupons",
  "Feedback, complaints & redressal flow",
  "KOT / KDS workflow automation",
  "Multi-outlet reporting dashboard",
  "Inventory, batches & wastage control",
  "Zomato and Swiggy relay",
];

export default function FeaturesPage() {
  return (
    <main className="site-theme bg-white text-slate-900 dark:bg-dark dark:text-white">
      <Navbar />

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(19,138,242,0.18),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_35%,#0f172a_100%)] pt-32 pb-20 md:pt-40">
        <div className="container">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div data-reveal>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
                Why operators choose pixaPOS
              </p>
              <h1 className="mb-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                A restaurant operating system built for speed, scale, and service.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-200">
                From live billing to kitchen execution, customer retention, and multi-outlet
                reporting, pixaPOS gives teams a single platform that grows with the business.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href={signUpUrl()}
                  className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Start free trial
                </Link>
                <Link
                  href="/#pricing"
                  className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
                >
                  View plans
                </Link>
              </div>
            </div>

            <div className="relative" data-reveal>
              <div className="absolute -inset-6 rounded-[32px] bg-[#17BF71]/15 blur-2xl" />
              <img
                src="https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80"
                alt="Restaurant team using digital POS and ordering system"
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
              Everything in one workflow
            </p>
            <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
              Built for modern hospitality teams.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {featureHighlights.map((feature, index) => (
              <article
                key={feature.title}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
                data-reveal
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                <img src={feature.image} alt={feature.title} className="h-56 w-full object-cover" />
                <div className="p-6">
                  <h3 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-base leading-7 text-slate-600 dark:text-slate-300">
                    {feature.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-dark">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div data-reveal>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#17BF71]">
                Full platform access
              </p>
              <h2 className="mb-5 text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
                Designed to handle every guest journey.
              </h2>
              <p className="max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Whether customers order at the table, on a kiosk, through a website, or via
                aggregator apps, every channel connects to the same kitchen, billing, inventory, and
                customer data layer.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2" data-reveal>
              {capabilityRows.map((row) => (
                <div
                  key={row}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#17BF71]/12 text-[#17BF71]">
                    ✓
                  </span>
                  <span>{row}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="container">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 md:p-10" data-reveal>
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">
                  Ready to scale?
                </p>
                <h3 className="text-3xl font-bold tracking-[-0.04em] md:text-4xl">
                  Turn every order, table, and outlet into a stronger operation.
                </h3>
              </div>
              <Link
                href={signUpUrl()}
                className="inline-flex items-center justify-center rounded-xl bg-[#17BF71] px-6 py-3 text-base font-semibold text-white shadow-[0_18px_40px_rgba(23,191,113,0.32)] transition hover:bg-[#11a75d]"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
