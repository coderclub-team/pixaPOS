import { NextResponse } from "next/server";

/**
 * Installable self-ordering kiosk PWA: standalone customer app with its own
 * icon and start URL.
 */
export async function GET() {
  return NextResponse.json({
    name: "pixaPOS — Self Order",
    short_name: "Order",
    description: "Self-ordering kiosk — browse the menu, build a cart and pay.",
    start_url: "/kiosk",
    scope: "/kiosk",
    id: "/kiosk",
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
