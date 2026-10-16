import { resolvePublicOutlet } from "@/lib/terminal-outlet";
import { OutletRouteSync } from "@/components/outlet-route-sync";
import QrShell from "../shell";

export const metadata = {
  title: "Table Order",
  description: "Order from your table — scan the QR, browse the menu and pay.",
};

/**
 * /qr/CODE placeholder (public — customers never sign in).
 * ?table= carries the scanned table; digital table ordering lands here next.
 */
export default async function QrOutletPage({
  params,
  searchParams,
}: {
  params: Promise<{ outlet: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { outlet } = await params;
  const { table } = await searchParams;
  const terminal = await resolvePublicOutlet(outlet);
  return (
    <OutletRouteSync outletId={terminal.id}>
      <QrShell>
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-lg font-bold">
            {table
              ? `Table ${table} — ${terminal.name} (order soon)`
              : `Table ordering — ${terminal.name} (coming soon)`}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {table
              ? `You scanned table ${table}. Digital ordering from the table lands here next: menu, cart and payment.`
              : "Scan a table QR code to order from your seat — menu, cart and payment."}
          </p>
        </div>
      </QrShell>
    </OutletRouteSync>
  );
}
