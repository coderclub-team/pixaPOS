import { NextResponse } from "next/server";

/** Installable table QR-ordering web manifest. */
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
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  });
}
