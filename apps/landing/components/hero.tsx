import Link from "next/link";
import { signUpUrl } from "@/lib/site";
import { TRIAL_DAYS } from "@/lib/plans";
import { Icons } from "@pixa/ui/icons";

const SURFACE_LINKS = [
  { label: "POS", href: "/#surfaces" },
  { label: "KDS", href: "/#surfaces" },
  { label: "Dispatch", href: "/#surfaces" },
  { label: "Kiosk", href: "/#surfaces" },
];

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
                  Six surfaces, one order truth
                </p>
                <div className="flex items-center justify-center gap-4 text-center">
                  {SURFACE_LINKS.map((s) => (
                    <Link
                      key={s.label}
                      href={s.href}
                      className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white/80 duration-300 ease-in-out hover:bg-white hover:text-dark"
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pb-[110px]" />
    </section>
  );
}
