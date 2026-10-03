import Link from "next/link";
import SectionTitle from "@/components/section-title";
import { signUpUrl } from "@/lib/site";
import { TRIAL_DAYS } from "@/lib/plans";

const QUOTES = [
  {
    name: "Quick-service owner",
    designation: "2 outlets · Counter + delivery",
    content:
      "Billing kept running through a 40-minute outage — KOTs fired, cash tallied, everything synced after.",
    tint: "bg-primary",
  },
  {
    name: "Cloud-kitchen operator",
    designation: "Delivery-first · 3 riders",
    content:
      "The dispatch board ended the chaos. Riders, COD and addresses in one place instead of phone calls.",
    tint: "bg-secondary",
  },
  {
    name: "Family restaurant manager",
    designation: "Dine-in · 14 tables",
    content:
      "We trialled on a Sunday lunch rush. By dinner the staff refused to go back to the old register.",
    tint: "bg-warn",
  },
];

export default function Testimonials() {
  return (
    <section id="customers" className="bg-white pt-20 pb-10 lg:pt-[120px] lg:pb-20 dark:bg-dark">
      <div className="container mx-auto">
        <div className="mb-[60px]">
          <SectionTitle
            subtitle="Customers"
            title={`Restaurants that switched during their ${TRIAL_DAYS}-day trial`}
            paragraph="Real counters, real lunch rushes — what owners say after the trial week."
            width="640px"
            center
          />
        </div>

        <div className="-mx-4 flex flex-wrap">
          {QUOTES.map((t) => (
            <div key={t.name} className="w-full px-4 md:w-1/2 lg:w-1/3">
              <div className="group mb-10">
                <div className="mb-8 overflow-hidden rounded">
                  <Link
                    href={signUpUrl()}
                    aria-label="customer story cover"
                    className={`block h-[272px] w-full ${t.tint} transition duration-300 group-hover:scale-105`}
                  >
                    <span className="flex h-full items-center justify-center px-8 text-center text-2xl font-bold text-white">
                      “{t.content}
                    </span>
                  </Link>
                </div>
                <div>
                  <span className="mb-5 inline-block rounded bg-primary px-4 py-1 text-center text-xs leading-loose font-semibold text-white">
                    {t.designation}
                  </span>
                  <h3>
                    <Link
                      href={signUpUrl()}
                      className="mb-4 inline-block text-xl font-semibold text-dark hover:text-primary sm:text-2xl lg:text-xl xl:text-2xl dark:text-white dark:hover:text-primary"
                    >
                      {t.name}
                    </Link>
                  </h3>
                  <p className="text-base text-body-color dark:text-dark-6">{t.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
