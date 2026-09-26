import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kiosk",
  description: "Self-ordering kiosk — coming soon.",
};

/**
 * /kiosk placeholder: customer self-ordering lives here next. Deliberately
 * public (no session gate) — customers never sign in. Future: menu browsing,
 * cart, customer notes (allergies) capture, KOT firing and payment.
 */
export default async function KioskPlaceholderPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-bold">Self-ordering — coming soon</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        The customer kiosk will live here: browse the menu, build a cart and pay.
      </p>
    </div>
  );
}
