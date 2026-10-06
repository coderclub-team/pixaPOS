const icons = [
  { src: "/icon.png", sizes: "512x512", type: "image/png" },
  { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export async function GET() {
  return Response.json({
    name: "pixaPOS — Rider",
    short_name: "Rider",
    description: "Rider runs — my assigned deliveries, COD, handover.",
    start_url: "/rider",
    scope: "/rider",
    id: "/rider",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons,
  });
}
