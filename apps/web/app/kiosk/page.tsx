import type { Metadata } from "next";
import { EnsureOutletDialog } from "@/components/ensure-outlet-dialog";
import KioskShell from "./shell";

export const metadata: Metadata = {
  title: "Kiosk",
  description: "Self-ordering kiosk — coming soon.",
  manifest: "/kiosk/manifest.webmanifest",
};

/**
 * Bare /kiosk (public): enter the outlet code to land on /kiosk/CODE.
 */
export default async function KioskPage() {
  return (
    <KioskShell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-bold">Self-ordering — coming soon</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The customer kiosk will live here: browse the menu, build a cart and pay.
        </p>
        <EnsureOutletDialog basePath="/kiosk" mode="code" />
      </div>
    </KioskShell>
  );
}
