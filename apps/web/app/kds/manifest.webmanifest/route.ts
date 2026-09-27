import { NextResponse } from "next/server";

/**
 * Installable KDS wallboard PWA: standalone kitchen app with its own icon
 * and start URL.
 */
export async function GET() {
  return NextResponse.json({
    name: "pixaPOS — Kitchen Display",
    short_name: "KDS",
    description: "Kitchen display — live tickets, offline-ready.",
    start_url: "/kds",
    scope: "/kds",
    id: "/kds",
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
