/** minimal Next.js config for pixaPOS web */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pixa/ui", "@pixa/contracts", "@pixa/db"],
  // Local HTTPS aliases (local.pixapos.store, LAN IPs) must be allowed to
  // load dev HMR/assets — browsers treat them as cross-origin vs localhost.
  allowedDevOrigins: ["local.pixapos.store", "*.local.pixapos.store", "10.99.120.225"],
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
