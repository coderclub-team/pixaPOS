import { Icons } from "@pixa/ui/icons";
import { Card, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";

const SURFACES = [
  {
    icon: "cart",
    title: "POS terminal",
    blurb: "Counter + table billing, KOT firing, split bills, UPI/cash/card.",
  },
  {
    icon: "kitchen",
    title: "Kitchen display",
    blurb: "Ticket wallboard with line-level accept, prepare, ready, serve.",
  },
  {
    icon: "clipboardList",
    title: "KOT",
    blurb: "Immutable kitchen tickets with voids, returns and waste routing.",
  },
  {
    icon: "send",
    title: "Dispatch console",
    blurb: "Rider assignment, out-for-delivery, COD collection, run sheets.",
  },
  {
    icon: "laptop",
    title: "Kiosk",
    blurb: "Customer self-ordering with PIN-locked outlet pairing.",
  },
  {
    icon: "receipt",
    title: "QR ordering",
    blurb: "Scan-to-order from the table — menu, cart and payment.",
  },
] as const;

export default function Surfaces() {
  return (
    <section id="surfaces" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
      <p className="text-center text-sm font-medium text-(--muted-foreground)">
        One subscription, every surface
      </p>
      <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-bold tracking-tight text-balance">
        Six surfaces, one order truth — online or on your LAN
      </h2>
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SURFACES.map((s) => {
          const Icon = Icons[s.icon];
          return (
            <li key={s.title}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="size-5 text-(--primary)" aria-hidden />
                    {s.title}
                  </CardTitle>
                  <CardDescription>{s.blurb}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
