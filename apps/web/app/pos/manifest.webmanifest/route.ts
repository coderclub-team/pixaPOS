const icons = [
  { src: "/icon.png", sizes: "512x512", type: "image/png" },
  { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

function surfaceManifest(name: string, shortName: string, startUrl: string, description: string) {
  return Response.json({
    name,
    short_name: shortName,
    description,
    start_url: startUrl,
    scope: startUrl,
    id: startUrl,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons,
  });
}

export async function GET() {
  return surfaceManifest(
    "pixaPOS — POS Terminal",
    "POS",
    "/pos",
    "Standalone order terminal — dine-in, counter, takeaway and delivery.",
  );
}
