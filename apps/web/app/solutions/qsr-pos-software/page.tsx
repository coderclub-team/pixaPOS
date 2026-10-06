import type { Metadata } from "next";
import IndustryPageTemplate from "@/components/site/industry-page-template";

export const metadata: Metadata = {
  title: "QSR POS Software for fast food brand operations",
  description:
    "QSR POS software built for quick service restaurants, cloud kitchens, and delivery-first brands. Optimize speed, stock, and kitchen flow.",
  keywords: [
    "qsr pos software",
    "fast food pos software",
    "cloud kitchen software",
    "delivery restaurant pos",
  ],
};

export default function QsrPosPage() {
  return (
    <IndustryPageTemplate
      title="QSR POS software designed for speed, repeat orders, and tight margins."
      description="Keep kitchen flow smooth, online orders connected, and service fast even during the busiest lunch and dinner rushes."
      heroImage="https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=80"
      heroAlt="QSR kitchen staff and ordering system"
      stats={[
        { label: "Rush hours", value: "Managed" },
        { label: "Channels", value: "All in one" },
        { label: "Kitchen", value: "Visible" },
      ]}
      features={[
        {
          title: "High-speed order capture",
          description:
            "Move orders quickly at the counter and through digital channels with a flow built for high transaction volume.",
          image:
            "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80",
          alt: "Fast-moving QSR order flow",
        },
        {
          title: "Delivery and aggregator workflows",
          description:
            "Bring delivery orders, menu sync, and kitchen tickets together so your team is never working in separate silos.",
          image:
            "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
          alt: "Delivery and restaurant order management",
        },
        {
          title: "Stock and cost visibility",
          description:
            "Track daily movement, wastage, and best sellers to protect margin across every menu item and ingredient.",
          image:
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
          alt: "Operational stock control for QSR brands",
        },
      ]}
      useCases={[
        "Counter service with minimal wait times",
        "Delivery order routing and menu sync",
        "Self-ordering and kiosk workflows",
        "Kitchen display with prep status visibility",
        "Repeat customer offers and coupons",
        "Daily reporting for multi-store performance",
      ]}
      benefits={[
        "Higher throughput per shift",
        "Better stock visibility",
        "Cleaner delivery operations",
        "Stronger branch-level control",
      ]}
      faqs={[
        {
          question: "Can QSR brands manage multiple outlets in one system?",
          answer:
            "Yes. Multi-outlet reporting, menu control, and shared operational data make it easier to grow without adding siloed tools.",
        },
        {
          question: "Does it support self-ordering and kiosks?",
          answer:
            "Yes. pixaPOS supports kiosk and QR ordering flows that complement counter service and delivery operations.",
        },
        {
          question: "Will it help with delivery order volume?",
          answer:
            "Yes. Kitchen routing and aggregator order handling reduce confusion between dine-in and delivery orders during peak service.",
        },
      ]}
    />
  );
}
