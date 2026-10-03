const icons = [
  { src: "/icon.png", sizes: "512x512", type: "image/png" },
  { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export async function GET() {
  return Response.json({
    name: "pixaPOS — Dispatch Console",
    short_name: "Dispatch",
    description: "Delivery dispatch — pack, assign riders and send orders out.",
    start_url: "/dispatch",
    scope: "/dispatch",
    id: "/dispatch",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons,
  });
}
