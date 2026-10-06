import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/site/footer";
import Navbar from "@/components/site/navbar";

export const metadata: Metadata = {
  title: "Contact pixaPOS",
  description:
    "Contact pixaPOS for a product demo, pricing discussion, or onboarding support for your restaurant or retail business.",
  keywords: [
    "contact pixaPOS",
    "restaurant pos demo",
    "pos sales support",
    "restaurant software support",
  ],
};

export default function ContactPage() {
  return (
    <main className="site-theme bg-white text-slate-900 dark:bg-dark dark:text-white">
      <Navbar />

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(19,138,242,0.18),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_35%,#0f172a_100%)] pt-32 pb-20 md:pt-40">
        <div className="container">
          <div className="mx-auto max-w-4xl text-center" data-reveal>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
              Talk to us
            </p>
            <h1 className="mb-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              Let’s design the right POS setup for your business.
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-8 text-slate-200">
              Whether you run a single restaurant or a growing multi-outlet food brand, we can help
              you choose the right workflow, stack, and rollout plan.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 dark:bg-dark-2">
        <div className="container grid gap-8 lg:grid-cols-3">
          <div
            className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_25px_60px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
            data-reveal
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#138AF2]">
              Email
            </p>
            <a
              href="mailto:hello@pixapos.store"
              className="text-xl font-semibold text-slate-900 dark:text-white"
            >
              hello@pixapos.store
            </a>
          </div>

          <div
            className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_25px_60px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
            data-reveal
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#138AF2]">
              Phone
            </p>
            <a
              href="tel:+919944781003"
              className="text-xl font-semibold text-slate-900 dark:text-white"
            >
              +91 9944 7810 03
            </a>
          </div>

          <div
            className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_25px_60px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
            data-reveal
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#138AF2]">
              WhatsApp
            </p>
            <a
              href="https://wa.me/919944781003"
              className="text-xl font-semibold text-slate-900 dark:text-white"
            >
              Chat with our team
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-dark">
        <div className="container grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div data-reveal>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#17BF71]">
              Why businesses contact us
            </p>
            <h2 className="mb-5 text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
              We help with demos, rollout, pricing, and growth planning.
            </h2>
            <ul className="space-y-3 text-lg leading-8 text-slate-600 dark:text-slate-300">
              <li>• Restaurant and café workflow review</li>
              <li>• Multi-outlet rollout planning</li>
              <li>• KOT, KDS, and delivery integration consult</li>
              <li>• Inventory, loyalty, and customer retention strategy</li>
            </ul>
          </div>

          <div
            className="rounded-[28px] border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900"
            data-reveal
          >
            <h3 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">
              Request a callback
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Business name
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="Your restaurant or brand"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Email
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="name@business.com"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Tell us a bit about your business
                </label>
                <textarea
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="Outlet count, menu type, ordering channels, and current pain points"
                />
              </div>
              <button className="w-full rounded-xl bg-[#138AF2] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#0b75d9]">
                Send enquiry
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
