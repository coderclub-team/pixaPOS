import { NextResponse } from "next/server";

/** Installable self-ordering kiosk web manifest. */
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
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  });
}
