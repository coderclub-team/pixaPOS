import type { Metadata } from "next";
import IndustryPageTemplate from "@/components/site/industry-page-template";

export const metadata: Metadata = {
  title: "Cafe POS Software for coffee shops and bakeries",
  description:
    "Cafe POS software for coffee shops, bakeries, dessert counters, and quick-service food brands. Fast billing, loyalty, and mobile operations built in.",
  keywords: [
    "cafe pos software",
    "coffee shop pos software",
    "bakery pos software",
    "restaurant pos for cafe",
  ],
};

export default function CafePosPage() {
  return (
    <IndustryPageTemplate
      title="Cafe POS software for faster service and stronger repeat sales."
      description="Serve coffees, snacks, desserts, and high-volume quick-turn batches without slowing down your barista or cashier team."
      heroImage="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80"
      heroAlt="Cafe counter and customer ordering experience"
      stats={[
        { label: "Queues", value: "Shorter" },
        { label: "Moments", value: "Faster" },
        { label: "Staff", value: "Less strain" },
      ]}
      features={[
        {
          title: "Fast counter billing",
          description:
            "Move through rush-hour orders quickly with a clear item grid, fast item search, and smooth checkout flow.",
          image:
            "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1200&q=80",
          alt: "Cafe counter billing workflow",
        },
        {
          title: "Loyalty and repeat visits",
          description:
            "Run promo bundles, flat discounts, loyalty points, and wallet add-ons to drive repeat customer traffic.",
          image:
            "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
          alt: "Customer loyalty in a cafe environment",
        },
        {
          title: "Inventory and prep management",
          description:
            "Track ingredients, baked goods, and peak-hour stock movements to prevent losses and stockouts before the rush begins.",
          image:
            "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
          alt: "Cafe kitchen and inventory management",
        },
      ]}
      useCases={[
        "Meet the morning rush without slow checkout",
        "Promote combo meals and bundle pricing",
        "Track best-sellers and wasted stock",
        "Run QR ordering and takeaway flows",
        "Manage dine-in plus takeaway from one system",
        "Support staff and owner visibility from mobile",
      ]}
      benefits={[
        "Fast service at peak volume",
        "Improved customer retention",
        "Lower ingredient wastage",
        "Clearer operational visibility",
      ]}
      faqs={[
        {
          question: "Can I run a cafe and delivery orders together?",
          answer:
            "Yes. pixaPOS lets you manage dine-in, takeaway, and delivery orders in one queue so team members and kitchen staff stay aligned.",
        },
        {
          question: "Is the system easy for new staff?",
          answer:
            "Yes. The interface is built to be simple and quick to learn, which is important in busy and high-turnover café teams.",
        },
        {
          question: "Does it support loyalty and wallet programs?",
          answer:
            "Yes. You can run loyalty tiers, prepaid bundles, and discount campaigns directly within the POS workflow.",
        },
      ]}
    />
  );
}
