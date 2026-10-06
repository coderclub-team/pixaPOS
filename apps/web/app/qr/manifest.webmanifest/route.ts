const icons = [
  { src: "/icon.png", sizes: "512x512", type: "image/png" },
  { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export async function GET() {
  return Response.json({
    name: "pixaPOS — Table Ordering",
    short_name: "Order",
    description: "Scan-to-order for guests.",
    start_url: "/qr",
    scope: "/qr",
    id: "/qr",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons,
  });
}
