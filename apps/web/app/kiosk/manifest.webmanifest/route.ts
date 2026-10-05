const icons = [
  { src: "/icon.png", sizes: "512x512", type: "image/png" },
  { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export async function GET() {
  return Response.json({
    name: "pixaPOS — Self Ordering",
    short_name: "Kiosk",
    description: "Self-ordering kiosk for guests.",
    start_url: "/kiosk",
    scope: "/kiosk",
    id: "/kiosk",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons,
  });
}
