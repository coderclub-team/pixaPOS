import { NextResponse } from "next/server";

/**
 * Installable table QR-ordering PWA: opened from table QR codes (?table=),
 * standalone with its own icon and start URL.
 */
export async function GET() {
  return NextResponse.json({
    name: "pixaPOS — Table Order",
    short_name: "Table",
    description: "Order from your table — scan, browse, pay.",
    start_url: "/qr",
    scope: "/qr",
    id: "/qr",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
}
