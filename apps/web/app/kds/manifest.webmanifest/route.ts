import { NextResponse } from "next/server";

/** Installable kitchen display web manifest. */
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
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  });
}
