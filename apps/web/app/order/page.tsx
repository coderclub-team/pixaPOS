import type { Metadata } from "next";
import QrShell from "../qr/shell";

export const metadata: Metadata = {
  title: "Order Online",
  description: "Order from the restaurant — menu, cart and payment.",
};

/**
 * /order — public online-ordering surface (order.pixapos.store).
 * Reuses the QR ordering shell until the dedicated storefront lands;
 * ?table= still carries a scanned table through.
 */
export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;
  return (
    <QrShell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-bold">
          {table ? `Table ${table} — order soon` : "Order online"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {table
            ? `You scanned table ${table}. Browse the menu, build your cart and pay — the kitchen fires your KOT.`
            : "Browse the menu, build your cart and pay online for pickup or delivery."}
        </p>
      </div>
    </QrShell>
  );
}
