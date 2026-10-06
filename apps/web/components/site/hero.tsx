import Link from "next/link";
import { signUpUrl } from "@/lib/site/site";
import { TRIAL_DAYS } from "@/lib/site/plans";
import { Icons } from "@pixa/ui/icons";

const PLATFORMS = ["PWA", "Android", "iPad", "Windows", "Web", "Offline-ready"];
const HIGHLIGHTS = [
  "Free restaurant website ordering",
  "Multi-outlet ready",
  "PWA across devices",
  "Offline-first billing",
];

export default function Hero() {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-primary pt-[120px] md:pt-[130px] lg:pt-[160px]"
    >
      <div className="absolute inset-0 opacity-90">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute right-0 top-12 h-64 w-64 rounded-full bg-sky-300/15 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />
      </div>

      <div className="container relative">
        <div className="grid items-center gap-10 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:pb-20">
          <div className="mx-auto max-w-[620px] text-center lg:mx-0 lg:text-left">
            <div className="animate-fade-up mb-5 flex flex-wrap items-center justify-center gap-3 lg:justify-start [animation-delay:0.05s]">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
                {TRIAL_DAYS}-day free trial · No card required
              </span>
            </div>

            <h1 className="animate-fade-up mb-6 text-4xl leading-tight font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-[4rem] lg:leading-[1.05] [animation-delay:0.1s]">
              Smarter restaurant operations for busy Indian food businesses.
            </h1>

            <p className="animate-fade-up mx-auto mb-8 max-w-[560px] text-base leading-7 text-white/80 sm:text-lg lg:mx-0 [animation-delay:0.2s]">
              Run your restaurant, café, QSR or multi-outlet brand from one modern POS built to
              scale without outlet, device or user restrictions.
            </p>

            <div className="animate-fade-up mb-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start [animation-delay:0.3s]">
              <Link
                href={signUpUrl()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-lg transition duration-300 hover:-translate-y-0.5 hover:bg-slate-100"
              >
                Start free trial
                <Icons.arrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="#pricing"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-base font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/10"
              >
                See pricing
              </Link>
            </div>

            <div className="animate-fade-up flex flex-wrap items-center justify-center gap-3 lg:justify-start [animation-delay:0.4s]">
              {HIGHLIGHTS.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition duration-300 hover:-translate-y-0.5 hover:bg-white/10"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[540px]">
            <div className="animate-float-slow absolute -left-8 top-2 h-20 w-20 rounded-full bg-[#17BF71]/20 blur-2xl" />
            <div className="animate-float-soft absolute -right-4 bottom-10 h-24 w-24 rounded-full bg-[#138AF2]/20 blur-2xl" />
            <div className="animate-float-soft absolute -inset-6 rounded-[2rem] bg-white/10 blur-2xl" />
            <div className="animate-fade-up relative overflow-hidden rounded-[28px] border border-white/20 bg-slate-950/90 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] [animation-delay:0.2s]">
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="size-2.5 rounded-full bg-[#28C840]" />
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                  live
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      live orders
                    </p>
                    <span className="text-xs text-slate-400">12:42 PM</span>
                  </div>

                  {[
                    {
                      name: "ORD-1042 · Table 12",
                      status: "Preparing",
                      color: "bg-amber-500/15 text-amber-300",
                    },
                    {
                      name: "ORD-1043 · Delivery",
                      status: "Ready",
                      color: "bg-emerald-500/15 text-emerald-300",
                    },
                    {
                      name: "ORD-1044 · Counter",
                      status: "New",
                      color: "bg-sky-500/15 text-sky-300",
                    },
                  ].map((order) => (
                    <div
                      key={order.name}
                      className="mb-2 flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2 transition-transform duration-300 hover:-translate-y-0.5 hover:bg-slate-800/80"
                    >
                      <span className="text-sm font-medium text-white">{order.name}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${order.color}`}
                      >
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    bill · ORD-1042
                  </p>

                  <div className="space-y-2 text-sm text-slate-200">
                    {[
                      ["Butter Chicken × 2", "₹560"],
                      ["Naan Basket × 1", "₹120"],
                      ["Fresh Lime × 2", "₹160"],
                    ].map(([item, amount]) => (
                      <div key={item} className="flex items-center justify-between gap-2">
                        <span>{item}</span>
                        <span className="font-semibold text-white">{amount}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-3">
                    <div className="mb-3 flex items-center justify-between text-sm font-semibold text-white">
                      <span>Total</span>
                      <span>₹840</span>
                    </div>
                    <button className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30">
                      Fire KOT
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ["₹24.8K", "Today sales"],
                  ["98%", "Uptime"],
                  ["7.2m", "Avg. prep"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="animate-pulse-glow rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-center"
                  >
                    <div className="text-xl font-bold text-white">{value}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pb-10 text-center text-sm text-white/70 md:pb-16">
          <p className="mb-4 uppercase tracking-[0.2em] text-white/60">Built for</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {PLATFORMS.map((platform) => (
              <span
                key={platform}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
