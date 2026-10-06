import Link from "next/link";
import Footer from "@/components/site/footer";
import Navbar from "@/components/site/navbar";
import { signUpUrl } from "@/lib/site/site";

export type IndustryPageTemplateProps = {
  title: string;
  description: string;
  heroImage: string;
  heroAlt: string;
  stats: { label: string; value: string }[];
  features: { title: string; description: string; image: string; alt: string }[];
  useCases: string[];
  benefits: string[];
  faqs: { question: string; answer: string }[];
};

export default function IndustryPageTemplate({
  title,
  description,
  heroImage,
  heroAlt,
  stats,
  features,
  useCases,
  benefits,
  faqs,
}: IndustryPageTemplateProps) {
  return (
    <main className="site-theme bg-white text-slate-900 dark:bg-dark dark:text-white">
      <Navbar />

      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(19,138,242,0.18),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_35%,#0f172a_100%)] pt-32 pb-20 md:pt-40">
        <div className="container">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div data-reveal>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
                pixaPOS for restaurants
              </p>
              <h1 className="mb-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-200">{description}</p>
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
                src={heroImage}
                alt={heroAlt}
                className="relative h-[520px] w-full rounded-[30px] border border-white/10 object-cover shadow-[0_40px_100px_rgba(15,23,42,0.4)]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 dark:bg-dark-2">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[24px] border border-slate-200 bg-white p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900"
                data-reveal
              >
                <div className="mb-2 text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-dark">
        <div className="container">
          <div className="mb-12 max-w-3xl" data-reveal>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#138AF2]">
              What operators get
            </p>
            <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
              Built for busy service teams and lean operations.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
                data-reveal
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                <img src={feature.image} alt={feature.alt} className="h-56 w-full object-cover" />
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

      <section className="bg-slate-50 py-20 dark:bg-dark-2">
        <div className="container grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div data-reveal>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#17BF71]">
              In real use
            </p>
            <h2 className="mb-5 text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
              The workflows that matter most in service.
            </h2>
            <p className="max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Every dashboard, payment, and kitchen update is designed to reduce queue time, speed
              up billing, and protect margin without forcing staff to learn a complicated system.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2" data-reveal>
            {useCases.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#17BF71]/12 text-[#17BF71]">
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-dark">
        <div className="container">
          <div className="mb-12 max-w-3xl" data-reveal>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#138AF2]">
              Why teams switch
            </p>
            <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
              Faster service, stronger control, better margins.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {benefits.map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900"
                data-reveal
              >
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#138AF2]/10 text-lg font-bold text-[#138AF2]">
                  ✓
                </div>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 dark:bg-dark-2">
        <div className="container max-w-4xl">
          <div className="mb-10 text-center" data-reveal>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#17BF71]">
              FAQ
            </p>
            <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white md:text-5xl">
              Common questions from growing operators.
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-[24px] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                data-reveal
              >
                <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
                  {faq.question}
                </h3>
                <p className="text-base leading-7 text-slate-600 dark:text-slate-300">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="container">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 md:p-10" data-reveal>
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">
                  Ready to optimize operations?
                </p>
                <h3 className="text-3xl font-bold tracking-[-0.04em] md:text-4xl">
                  See how pixaPOS fits your outlet and your growth plan.
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
