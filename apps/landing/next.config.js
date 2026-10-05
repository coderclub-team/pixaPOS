/** minimal Next.js config for pixaPOS landing */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pixa/ui"],
  // Marketing site is fully static: export plain HTML, zero serverless
  // functions (also immune to cold starts and tracing issues on deploy).
  output: "export",
};

module.exports = nextConfig;
