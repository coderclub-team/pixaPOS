import { TRIAL_DAYS } from "@/lib/plans";
import { Card, CardContent } from "@pixa/ui/base-ui/card";

const QUOTES = [
  {
    quote:
      "Billing kept running through a 40-minute outage — KOTs fired, cash tallied, everything synced after.",
    name: "Quick-service owner",
    detail: "2 outlets · Counter + delivery",
  },
  {
    quote:
      "The dispatch board ended the chaos. Riders, COD and addresses in one place instead of phone calls.",
    name: "Cloud-kitchen operator",
    detail: "Delivery-first · 3 riders",
  },
  {
    quote:
      "We trialled on a Sunday lunch rush. By dinner the staff refused to go back to the old register.",
    name: "Family restaurant manager",
    detail: "Dine-in · 14 tables",
  },
];

export default function Testimonials() {
  return (
    <section id="customers" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
      <p className="text-center text-sm font-medium text-(--muted-foreground)">Customers</p>
      <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-bold tracking-tight text-balance">
        Restaurants that switched during their {TRIAL_DAYS}-day trial
      </h2>
      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {QUOTES.map((q) => (
          <li key={q.name} className="h-full">
            <Card className="h-full">
              <CardContent className="grid gap-3 pt-6">
                <p className="text-sm leading-relaxed">“{q.quote}”</p>
                <p className="text-sm">
                  <span className="font-semibold">{q.name}</span>
                  <span className="block text-xs text-(--muted-foreground)">{q.detail}</span>
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
