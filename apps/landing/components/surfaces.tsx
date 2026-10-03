import Link from "next/link";
import { signUpUrl } from "@/lib/site";
import { Icons } from "@pixa/ui/icons";
import SectionTitle from "@/components/section-title";

const FEATURES = [
  {
    icon: "cart",
    title: "POS terminal",
    paragraph: "Counter + table billing, KOT firing, split bills, UPI, cash and card.",
  },
  {
    icon: "kitchen",
    title: "Kitchen display",
    paragraph: "Ticket wallboard with line-level accept, prepare, ready and serve.",
  },
  {
    icon: "clipboardList",
    title: "KOT",
    paragraph: "Immutable kitchen tickets with voids, returns and waste routing.",
  },
  {
    icon: "send",
    title: "Dispatch console",
    paragraph: "Rider assignment, out-for-delivery, COD collection and run sheets.",
  },
  {
    icon: "laptop",
    title: "Kiosk",
    paragraph: "Customer self-ordering with PIN-locked outlet pairing.",
  },
  {
    icon: "receipt",
    title: "QR ordering",
    paragraph: "Scan-to-order from the table — menu, cart and payment.",
  },
] as const;

export default function Surfaces() {
  return (
    <section id="surfaces" className="pt-20 pb-8 lg:pt-[120px] lg:pb-[70px]">
      <div className="container">
        <div className="mb-[60px]">
          <SectionTitle
            subtitle="Six surfaces"
            title="One subscription, every counter"
            paragraph="Every surface reads the same order truth — online on the cloud, offline on your LAN."
            center
          />
        </div>
        <div className="-mx-4 flex flex-wrap">
          {FEATURES.map((feature) => {
            const Icon = Icons[feature.icon];
            return (
              <div key={feature.title} className="w-full px-4 md:w-1/2 lg:w-1/3">
                <div className="group mb-12">
                  <div className="relative z-10 mb-8 flex h-[70px] w-[70px] items-center justify-center rounded-2xl bg-primary">
                    <span className="absolute top-0 left-0 z-[-1] mb-8 flex h-[70px] w-[70px] rotate-[25deg] items-center justify-center rounded-2xl bg-primary/20 duration-300 group-hover:rotate-45" />
                    <Icon className="size-8 text-white" aria-hidden />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-dark dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mb-8 text-body-color lg:mb-11 dark:text-dark-6">
                    {feature.paragraph}
                  </p>
                  <Link
                    href={signUpUrl()}
                    className="text-base font-medium text-dark hover:text-primary dark:text-white dark:hover:text-primary"
                  >
                    Try it free
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
