import { EnsureOutletDialog } from "@/components/ensure-outlet-dialog";
import QrShell from "./shell";

export const metadata = {
  title: "Table Order",
  description: "Order from your table — scan the QR, browse the menu and pay.",
  manifest: "/qr/manifest.webmanifest",
};

/**
 * Bare /qr (public): enter the outlet code (or scan a table QR) to land
 * on /qr/CODE. ?table= carries the scanned table through.
 */
export default async function QrPage() {
  return (
    <QrShell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-bold">Table ordering — coming soon</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Scan a table QR code to order from your seat — menu, cart and payment.
        </p>
        <EnsureOutletDialog basePath="/qr" mode="code" />
      </div>
    </QrShell>
  );
}
