import { NextResponse } from "next/server";

/**
 * Installable POS terminal PWA: standalone counter app with its own icon
 * and start URL, so it installs separately from the dashboard.
 */
export async function GET() {
  return NextResponse.json({
    name: "pixaPOS — Counter Terminal",
    short_name: "POS",
    description: "Counter terminal — dine-in, counter, takeaway and delivery orders.",
    start_url: "/pos",
    scope: "/pos",
    id: "/pos",
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
