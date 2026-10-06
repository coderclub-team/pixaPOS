import SectionTitle from "@/components/site/section-title";

const ROWS = [
  {
    label: "Kitchen Display (KDS)",
    ordinary: "Costly add-on or not available",
    pixa: "Built in for every outlet",
  },
  {
    label: "Captain / waiter app",
    ordinary: "Rarely offered or locked behind another app",
    pixa: "Included and ready for offline service",
  },
  {
    label: "Advanced loyalty, wallet & packages",
    ordinary: "Separate paid software",
    pixa: "Built in with no extra platform fee",
  },
  {
    label: "Billing during internet or power issues",
    ordinary: "Orders and billing stop",
    pixa: "Local-first billing continues offline",
  },
  {
    label: "Multi-outlet dashboard",
    ordinary: "Extra license per location",
    pixa: "One dashboard for 1 to 1,000 outlets",
  },
  {
    label: "Swiggy & Zomato orders in the POS",
    ordinary: "Separate tablet or external process",
    pixa: "All orders visible on one screen",
  },
  {
    label: "Price",
    ordinary: "Higher with recurring add-ons",
    pixa: "From ₹399/month",
  },
  {
    label: "Support",
    ordinary: "Slow ticket queue and office hours",
    pixa: "24x7 WhatsApp and call support",
  },
] as const;

export default function CompareSection() {
  return (
    <section id="compare" className="bg-slate-50 py-16 lg:py-24 dark:bg-dark-2">
      <div className="container">
        <div className="mb-8 max-w-3xl" data-reveal>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Why pixaPOS
          </p>
          <h2 className="mb-5 text-3xl leading-tight font-bold text-dark sm:text-[40px] sm:leading-[1.15] dark:text-white">
            pixaPOS vs an ordinary POS
          </h2>
          <p className="text-base leading-relaxed text-body-color dark:text-dark-6">
            The features many restaurant systems charge extra for are already built into pixaPOS —
            from KDS and captain apps to loyalty, offline billing, and growth-ready multi-outlet
            controls.
          </p>
        </div>

        <div
          className="mt-10 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900"
          data-reveal
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-200 sm:px-6">
                    What you need
                  </th>
                  <th className="px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-200 sm:px-6">
                    Ordinary POS
                  </th>
                  <th className="px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-200 sm:px-6">
                    pixaPOS
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, index) => (
                  <tr
                    key={row.label}
                    className={
                      index % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-950/60"
                    }
                  >
                    <td className="px-5 py-4 align-top text-base font-semibold text-slate-900 dark:text-white sm:px-6">
                      {row.label}
                    </td>
                    <td className="px-5 py-4 align-top text-base text-red-600 dark:text-red-400 sm:px-6">
                      {row.ordinary}
                    </td>
                    <td className="px-5 py-4 align-top text-base font-medium text-emerald-700 dark:text-emerald-300 sm:px-6">
                      <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        ✓
                      </span>
                      {row.pixa}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
