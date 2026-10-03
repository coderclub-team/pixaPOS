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
    <section id="faq" className="mx-auto w-full max-w-4xl scroll-mt-20 px-4 py-14 sm:px-6">
      <p className="text-center text-sm font-medium text-(--muted-foreground)">FAQ</p>
      <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-bold tracking-tight text-balance">
        Trial, billing and offline — answered
      </h2>
      <div className="mt-8">
        {QA.map((item) => (
          <div key={item.q} className="mb-8 flex gap-4 last:mb-0">
            <div className="flex size-10 w-full max-w-10 shrink-0 items-center justify-center rounded-xl bg-(--primary) text-base font-bold text-(--primary-foreground)">
              ?
            </div>
            <div className="w-full">
              <h3 className="mb-2 text-lg font-semibold">{item.q}</h3>
              <p className="text-sm leading-relaxed text-(--muted-foreground)">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
