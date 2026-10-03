import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "pixaPOS — Restaurant OS with a 14-day free trial",
    template: "%s | pixaPOS",
  },
  description:
    "Local-first restaurant operations: POS, KDS, KOT, kiosk, QR ordering and dispatch. Start your 14-day free trial — no credit card required.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
