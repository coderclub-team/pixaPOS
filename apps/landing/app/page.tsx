import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import Surfaces from "@/components/surfaces";
import Pricing from "@/components/pricing";
import Testimonials from "@/components/testimonials";
import CtaBanner from "@/components/cta-banner";
import Footer from "@/components/footer";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-(--background) text-(--foreground)">
      <Navbar />
      <main>
        <Hero />
        <Surfaces />
        <Pricing />
        <Testimonials />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
