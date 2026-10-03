import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import Surfaces from "@/components/surfaces";
import About from "@/components/about";
import CtaBanner from "@/components/cta-banner";
import Pricing from "@/components/pricing";
import Testimonials from "@/components/testimonials";
import Faq from "@/components/faq";
import Team from "@/components/team";
import BlogSection from "@/components/blog-section";
import Contact from "@/components/contact";
import Clients from "@/components/clients";
import Footer from "@/components/footer";
import ScrollToTop from "@/components/scroll-to-top";

export default function LandingPage() {
  return (
    <main>
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
