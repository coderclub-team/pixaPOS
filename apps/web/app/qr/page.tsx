import type { Metadata } from "next";
import QrShell from "./shell";

export const metadata: Metadata = {
  title: "Table Order",
  description: "Order from your table — scan the QR, browse the menu and pay.",
  manifest: "/qr/manifest.webmanifest",
};

/**
 * /qr placeholder (public — customers never sign in). ?table= carries the
 * scanned table; digital table ordering lands here next.
 */
export default async function QrPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;
  return (
    <QrShell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-bold">
          {table ? `Table ${table} — order soon` : "Table ordering — coming soon"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {table
            ? `You scanned table ${table}. Digital ordering from the table lands here next: menu, cart and payment.`
            : "Scan a table QR code to order from your seat — menu, cart and payment."}
        </p>
      </div>
    </QrShell>
  );
}
