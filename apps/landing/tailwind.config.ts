import type { Config } from "tailwindcss";

/**
 * Brand theme: pixaPOS uses the monochrome Vercel token set
 * (see @pixa/ui themes/vercel.css — black primary on light,
 * white primary on dark). Landing extends it, never replaces it.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
