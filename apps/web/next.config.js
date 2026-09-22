/** minimal Next.js config for pixaPOS web */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pixa/ui", "@pixa/contracts", "@pixa/db"],
  images: {
    remotePatterns: [
      // Neon object storage endpoints are branch-scoped
      // (<branch>.storage.c-4.<region>.aws.neon.tech).
      { protocol: "https", hostname: "*.neon.tech" },
    ],
  },
};
module.exports = nextConfig;
