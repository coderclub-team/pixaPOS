import SectionTitle from "@/components/section-title";

const QA = [
  {
    q: "How does the 14-day free trial work?",
    a: "Sign up with just an email — no credit card. You get every Growth feature for 14 days: POS, KDS, dispatch, inventory, promos. If the trial lapses before you subscribe, the workspace locks but your menu, tables and history are kept.",
  },
  {
    q: "Is pricing per outlet or per user?",
    a: "Per outlet, like Zoho POS. One subscription covers unlimited registers and staff at that outlet. Add outlets as you grow; each bills at the same plan rate with a ~20% annual discount.",
  },
  {
    q: "What happens when the internet goes down?",
    a: "The counter keeps billing, the kitchen keeps firing KOTs and riders keep delivering on your local network. Everything reconciles with the cloud when you're back — nothing is silently discarded.",
  },
  {
    q: "Who owns my data and my subscription?",
    a: "You do. One account holds the subscription; outlets hang under it as operational units. Export your menu, customers, orders and ledgers as CSV any time — including during the trial.",
  },
  {
    q: "Do online orders (Zomato / Swiggy) work with pixaPOS?",
    a: "Yes — aggregator orders relay into the same pipeline: accept, fire KOT, mark ready, dispatch and deliver, with the same audit trail as counter orders.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Monthly plans cancel in one click and run to the end of the billing period. Annual plans are refunded pro-rata in the first 30 days.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="pt-20 pb-8 lg:pt-[120px] lg:pb-[70px]">
      <div className="container">
        <div className="mb-[60px]">
          <SectionTitle
            subtitle="FAQ"
            title="Trial, billing and offline — answered"
            paragraph="The questions every owner asks before the trial week."
            center
          />
        </div>
        <div className="mx-auto" style={{ maxWidth: "770px" }}>
          {QA.map((item) => (
            <div key={item.q} className="mb-12 flex lg:mb-[70px]">
              <div className="mr-4 flex h-[50px] w-full max-w-[50px] items-center justify-center rounded-xl bg-primary text-lg font-bold text-white sm:mr-6 sm:h-[60px] sm:max-w-[60px]">
                ?
              </div>
              <div className="w-full">
                <h3 className="mb-6 text-xl font-semibold text-dark sm:text-2xl lg:text-xl xl:text-2xl dark:text-white">
                  {item.q}
                </h3>
                <p className="text-base text-body-color dark:text-dark-6">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
