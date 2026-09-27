import { NextResponse } from "next/server";

/** Installable POS terminal web manifest (start_url scope keeps it a separate app icon). */
export async function GET() {
  return NextResponse.json({
    name: "pixaPOS — Counter Terminal",
    short_name: "POS",
    description: "Counter terminal — orders, bills and KOTs.",
    start_url: "/pos",
    scope: "/pos",
    id: "/pos",
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
