import Link from "next/link";
import { signUpUrl } from "@/lib/site";
import { TRIAL_DAYS } from "@/lib/plans";
import { Icons } from "@pixa/ui/icons";

const PLATFORMS = ["Windows", "Android", "iOS", "Web", "Counter tablets"];

export default function Hero() {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-primary pt-[120px] md:pt-[130px] lg:pt-[160px]"
    >
      <div className="container">
        <div className="-mx-4 flex flex-wrap items-center">
          <div className="w-full px-4">
            <div className="hero-content mx-auto max-w-[780px] text-center">
              <span className="mb-5 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white">
                {TRIAL_DAYS}-day free trial · No credit card required
              </span>
              <h1 className="mb-6 text-3xl leading-snug font-bold text-white sm:text-4xl sm:leading-snug lg:text-5xl lg:leading-[1.2]">
                The restaurant OS that keeps selling when the internet doesn&apos;t
              </h1>
              <p className="mx-auto mb-9 max-w-[600px] text-base font-medium text-white sm:text-lg sm:leading-[1.44]">
                POS, kitchen display, KOT, kiosk, QR ordering and dispatch — one subscription per
                outlet, live online and offline on your own network.
              </p>
              <ul className="mb-10 flex flex-wrap items-center justify-center gap-5">
                <li>
                  <Link
                    href={signUpUrl()}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-7 py-[14px] text-center text-base font-medium text-dark shadow-1 transition duration-300 ease-in-out hover:bg-gray-2"
                  >
                    Start {TRIAL_DAYS}-day free trial
                    <Icons.arrowRight className="size-4" aria-hidden />
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pricing"
                    className="inline-flex items-center justify-center rounded-md bg-white/[0.12] px-6 py-[14px] text-base font-medium text-white transition duration-300 ease-in-out hover:bg-white hover:text-dark"
                  >
                    See pricing
                  </Link>
                </li>
              </ul>

              <div>
                <p className="mb-4 text-center text-base font-medium text-white/60">
                  pixaPOS is a PWA — install it on any platform
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 text-center">
                  {PLATFORMS.map((platform) => (
                    <span
                      key={platform}
                      className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white/80"
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="-mx-4 flex flex-wrap">
          <div className="w-full px-4">
            <div className="relative z-10 mx-auto max-w-[845px]">
              <div className="mt-16">
                <div className="mx-auto max-w-full overflow-hidden rounded-t-xl bg-white text-left shadow-[0px_0px_60px_0px_rgba(0,0,0,0.25)]">
                  <div className="flex items-center gap-1.5 border-b border-stroke px-4 py-2.5">
                    <span className="size-2.5 rounded-full bg-[#FF5F57]" />
                    <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
                    <span className="size-2.5 rounded-full bg-[#28C840]" />
                    <span className="ml-2 rounded bg-gray-1 px-3 py-0.5 text-xs text-body-color">
                      app.pixapos.store/pos
                    </span>
                  </div>
                  <div className="grid grid-cols-5">
                    <div className="col-span-3 border-r border-stroke p-4">
                      <p className="mb-3 text-xs font-semibold tracking-wide text-body-color uppercase">
                        Live orders
                      </p>
                      {[
                        {
                          n: "ORD-1042 · Table 12",
                          s: "Preparing",
                          c: "bg-warn/15 text-warn",
                        },
                        {
                          n: "ORD-1043 · Delivery",
                          s: "Ready",
                          c: "bg-secondary/15 text-secondary",
                        },
                        { n: "ORD-1044 · Counter", s: "New", c: "bg-primary/10 text-primary" },
                      ].map((o) => (
                        <div
                          key={o.n}
                          className="mb-2 flex items-center justify-between rounded-lg bg-gray-1 px-3 py-2"
                        >
                          <span className="text-sm font-medium text-dark">{o.n}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.c}`}
                          >
                            {o.s}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="col-span-2 p-4">
                      <p className="mb-3 text-xs font-semibold tracking-wide text-body-color uppercase">
                        Bill · ORD-1042
                      </p>
                      {[
                        ["Butter Chicken × 2", "₹560"],
                        ["Naan Basket × 1", "₹120"],
                        ["Fresh Lime × 2", "₹160"],
                      ].map(([item, amt]) => (
                        <div key={item} className="mb-1.5 flex justify-between text-sm text-dark">
                          <span>{item}</span>
                          <span className="font-medium">{amt}</span>
                        </div>
                      ))}
                      <div className="mt-3 flex justify-between border-t border-stroke pt-2 text-sm font-bold text-dark">
                        <span>Total</span>
                        <span>₹840</span>
                      </div>
                      <div className="mt-3 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-white">
                        Fire KOT
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-0 -left-9 z-[-1]">
                <svg width="134" height="106" viewBox="0 0 134 106" fill="none">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <circle
                      key={i}
                      cx={1.66667 + (i % 6) * 14.6666}
                      cy={104 - Math.floor(i / 6) * 14.6666}
                      r="1.66667"
                      fill="white"
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
