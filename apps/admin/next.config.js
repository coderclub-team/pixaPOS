/** pixaPOS SaaS owner console (admin.pixapos.store). Standalone deploy. */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pixa/ui", "@pixa/contracts", "@pixa/db"],
};

export default nextConfig;
