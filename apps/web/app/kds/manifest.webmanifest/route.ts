const icons = [
  { src: "/icon.png", sizes: "512x512", type: "image/png" },
  { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export async function GET() {
  return Response.json({
    name: "pixaPOS — Kitchen Display",
    short_name: "KDS",
    description: "Kitchen display wallboard — tickets, lines and timers.",
    start_url: "/kds",
    scope: "/kds",
    id: "/kds",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons,
  });
}
