import type { Metadata } from "next";
import IndustryPageTemplate from "@/components/site/industry-page-template";

export const metadata: Metadata = {
  title: "Retail POS Software for stores and boutique chains",
  description:
    "Retail POS software for fast-moving stores, boutiques, and multi-location retail businesses. Manage inventory, billing, and sales reporting with confidence.",
  keywords: [
    "retail pos software",
    "shop billing software",
    "inventory pos for retail",
    "multi-store retail software",
  ],
};

export default function RetailPosPage() {
  return (
    <IndustryPageTemplate
      title="Retail POS software for modern stores and growing chains."
      description="Run billing, stock, category management, and customer offers from a retail-friendly operating system built for speed and control."
      heroImage="https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80"
      heroAlt="Retail shop sales and inventory management"
      stats={[
        { label: "Counters", value: "Multi-device" },
        { label: "Stock", value: "Visible" },
        { label: "Reports", value: "Live" },
      ]}
      features={[
        {
          title: "Fast billing and barcode support",
          description:
            "Serve customers quickly with clear product search, barcode scanning, and a clean checkout workflow that reduces manual effort.",
          image:
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
          alt: "Retail billing and product scanning",
        },
        {
          title: "Inventory and stock control",
          description:
            "Track stock movement, low inventory, and sales trends so your store stays stocked and margins remain healthy.",
          image:
            "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
          alt: "Inventory management for retail store",
        },
        {
          title: "Customer retention tools",
          description:
            "Run discounts, special offers, and loyalty campaigns that keep customers coming back without adding extra complexity.",
          image:
            "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
          alt: "Customer retention tools for retail businesses",
        },
      ]}
      useCases={[
        "Barcode sales and category-based checkout",
        "Multi-store reporting for business owners",
        "Low-stock alerts and purchase planning",
        "Sales offers and bundle promotions",
        "Role-based access for managers and cashiers",
        "Daily performance and margin reporting",
      ]}
      benefits={[
        "Lower handling time at checkout",
        "Fewer stock mistakes and shrinkage",
        "More repeat business through offers",
        "Better visibility across stores",
      ]}
      faqs={[
        {
          question: "Can I use it for a boutique or apparel store?",
          answer:
            "Yes. Retail teams often need product grouping, pricing control, promotions, and quick sales workflows, all of which are supported by pixaPOS.",
        },
        {
          question: "Can multiple counters work together?",
          answer:
            "Yes. The platform is designed to support multi-device and store-level operations with consistent data and reporting.",
        },
        {
          question: "Does it help with stock planning?",
          answer:
            "Yes. Daily sales and stock tracking help managers identify fast-moving items, low inventory, and operational losses earlier.",
        },
      ]}
    />
  );
}
