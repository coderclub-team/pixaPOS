import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import Hero from "@/components/site/hero";
import Surfaces from "@/components/site/surfaces";
import About from "@/components/site/about";
import CtaBanner from "@/components/site/cta-banner";
import Pricing from "@/components/site/pricing";
import Testimonials from "@/components/site/testimonials";
import Faq from "@/components/site/faq";
import Team from "@/components/site/team";
import BlogSection from "@/components/site/blog-section";
import Contact from "@/components/site/contact";
import Careers from "@/components/site/careers";
import Clients from "@/components/site/clients";
import Footer from "@/components/site/footer";
import ScrollToTop from "@/components/site/scroll-to-top";
import { getMarketingPlans } from "@/lib/site/plans-server";

export const metadata: Metadata = {
  title: {
    default: "pixaPOS — Restaurant POS for Indian food businesses",
    template: "%s | pixaPOS",
  },
  description:
    "pixaPOS is a PWA-first restaurant POS for Indian cafés, QSRs, cloud kitchens, and multi-outlet food brands. Run billing, kitchen display, inventory, loyalty, and delivery operations from any device.",
  keywords: [
    "restaurant pos software india",
    "restaurant billing software",
    "pos for restaurant",
    "restaurant management system",
    "multi outlet pos",
    "pwa restaurant pos",
    "kitchen display system",
    "cloud kitchen software",
    "restaurant pos for cafes and qsr",
  ],
  alternates: {
    canonical: "https://pixapos.store",
  },
};

/**
 * Marketing site (moved from apps/landing). Public on pixapos.store and www;
 * every other surface host rewrites here only for unknown paths (see lib/hosts).
 * Plans come from the owner-managed DB catalog (fallback: static catalog).
 */
export default async function MarketingPage() {
  const plans = await getMarketingPlans();
  return (
    <main className="site-theme">
      <ScrollToTop />
      <Navbar />
      <Hero />
      <Surfaces />
      <About />
      <CtaBanner />
      <Pricing plans={plans} />
      <Testimonials />
      <Faq />
      <Team />
      <BlogSection />
      <Careers />
      <Contact />
      <Clients />
      <Footer />
    </main>
  );
}
