import SectionTitle from "@/components/section-title";
import { TRIAL_DAYS } from "@/lib/plans";

const QUOTES = [
  {
    star: 5,
    content:
      "Billing kept running through a 40-minute outage — KOTs fired, cash tallied, everything synced after.",
    name: "Quick-service owner",
    designation: "2 outlets · Counter + delivery",
  },
  {
    star: 5,
    content:
      "The dispatch board ended the chaos. Riders, COD and addresses in one place instead of phone calls.",
    name: "Cloud-kitchen operator",
    designation: "Delivery-first · 3 riders",
  },
  {
    star: 5,
    content:
      "We trialled on a Sunday lunch rush. By dinner the staff refused to go back to the old register.",
    name: "Family restaurant manager",
    designation: "Dine-in · 14 tables",
  },
];

const starIcon = (
  <svg width="18" height="16" viewBox="0 0 18 16" className="fill-current">
    <path d="M9.09815 0.360596L11.1054 6.06493H17.601L12.3459 9.5904L14.3532 15.2947L9.09815 11.7693L3.84309 15.2947L5.85035 9.5904L0.595291 6.06493H7.0909L9.09815 0.360596Z" />
  </svg>
);

export default function Testimonials() {
  return (
    <section id="customers" className="bg-[#F8FAFC] py-20 lg:py-[120px] dark:bg-dark">
      <div className="container">
        <div className="mb-[60px]">
          <SectionTitle
            subtitle="Customers"
            title={`Restaurants that switched during their ${TRIAL_DAYS}-day trial`}
            paragraph="Real counters, real lunch rushes — what owners say after the trial week."
            center
          />
        </div>
        <div className="-mx-4 flex flex-wrap">
          {QUOTES.map((t) => (
            <div key={t.name} className="w-full px-4 md:w-1/2 lg:w-1/3">
              <div className="rounded-xl bg-white px-4 py-[30px] shadow-testimonial sm:px-[30px] dark:bg-dark-2">
                <div className="mb-[18px] flex items-center gap-[2px]">
                  {Array.from({ length: t.star }).map((_, i) => (
                    <span key={i} className="text-[#fbb040]">
                      {starIcon}
                    </span>
                  ))}
                </div>
                <p className="mb-6 text-base text-body-color dark:text-dark-6">“{t.content}</p>
                <div className="flex items-center gap-4">
                  <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-bold text-white">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-dark dark:text-white">{t.name}</h3>
                    <p className="text-body-secondary text-xs">{t.designation}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
