/** minimal Next.js config for pixaPOS web */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Single-editor consolidation: the active-scoped profile page is gone;
      // the outlet list lets the user pick explicitly.
      {
        source: "/dashboard/settings/outlet/profile",
        destination: "/dashboard/settings/outlets",
        permanent: false,
      },
    ];
  },
  transpilePackages: ["@pixa/ui", "@pixa/contracts", "@pixa/db"],
  // Local HTTPS aliases (local.pixapos.store, LAN IPs) must be allowed to
  // load dev HMR/assets — browsers treat them as cross-origin vs localhost.
  allowedDevOrigins: [
    "local.pixapos.store",
    "*.local.pixapos.store",
    "10.32.212.225",
    "192.168.31.58",
  ],
  images: {
    remotePatterns: [
      // Neon object storage endpoints are branch-scoped
      // (<branch>.storage.c-4.<region>.aws.neon.tech).
      { protocol: "https", hostname: "*.neon.tech" },
      // Dev menu seed photos (Unsplash CDN).
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};
module.exports = nextConfig;
