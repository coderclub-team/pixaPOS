/** minimal Next.js config for pixaPOS web */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pixa/ui", "@pixa/contracts", "@pixa/db"],
};
module.exports = nextConfig;
