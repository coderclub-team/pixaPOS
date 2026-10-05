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
import Clients from "@/components/site/clients";
import Footer from "@/components/site/footer";
import ScrollToTop from "@/components/site/scroll-to-top";

export const metadata: Metadata = {
  title: {
    default: "pixaPOS — Restaurant OS with a 14-day free trial",
    template: "%s | pixaPOS",
  },
  description:
    "Local-first restaurant operations: POS, KDS, KOT, kiosk, QR ordering and dispatch. Start your 14-day free trial — no credit card required.",
};

/**
 * Marketing site (moved from apps/landing). Public on pixapos.store and www;
 * every other surface host rewrites here only for unknown paths (see lib/hosts).
 */
export default function MarketingPage() {
  return (
    <main className="site-theme">
      <ScrollToTop />
      <Navbar />
      <Hero />
      <Surfaces />
      <About />
      <CtaBanner />
      <Pricing />
      <Testimonials />
      <Faq />
      <Team />
      <BlogSection />
      <Contact />
      <Clients />
      <Footer />
    </main>
  );
}
