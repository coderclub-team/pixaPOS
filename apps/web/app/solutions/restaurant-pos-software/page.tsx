import type { Metadata } from "next";
import IndustryPageTemplate from "@/components/site/industry-page-template";

export const metadata: Metadata = {
  title: "Restaurant POS Software for Indian dining businesses",
  description:
    "Modern restaurant POS software for dine-in, takeaway, delivery, KOT, inventory, and customer loyalty. Built for Indian restaurants and multi-outlet groups.",
  keywords: [
    "restaurant pos software",
    "restaurant billing software",
    "pos for restaurant india",
    "restaurant inventory management",
    "table management pos",
  ],
};

export default function RestaurantPosPage() {
  return (
    <IndustryPageTemplate
      title="Restaurant POS software built for fast service and tighter control."
      description="Manage orders, tables, kitchen tickets, stock, loyalty, and delivery from one restaurant operating system designed for busy dining teams in India."
      heroImage="https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80"
      heroAlt="Restaurant team using a modern POS system"
      stats={[
        { label: "Outlets", value: "1 to 100+" },
        { label: "Orders", value: "Fast + accurate" },
        { label: "Support", value: "24/7" },
      ]}
      features={[
        {
          title: "Table and counter billing",
          description:
            "Serve dine-in guests, takeaway customers, and counter sales from one streamlined flow that keeps service moving at peak hours.",
          image:
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
          alt: "Restaurant tables and customer service workflow",
        },
        {
          title: "Kitchen display & KOT routing",
          description:
            "Send orders instantly to the kitchen, track prep status, and reduce delays with cleaner kitchen communication.",
          image:
            "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
          alt: "Kitchen display with live order tickets",
        },
        {
          title: "Inventory and wastage tracking",
          description:
            "Monitor ingredient stock, batches, recipe usage, and wastage across the day so your kitchen runs leaner and smarter.",
          image:
            "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
          alt: "Restaurant inventory planning and stock tracking",
        },
      ]}
      useCases={[
        "Table-wise order taking and KOT routing",
        "Delivery and takeaway order consolidation",
        "Live stock and recipe tracking",
        "QR ordering and self-ordering flows",
        "Loyalty, discount, and membership campaigns",
        "Daily sales, GST, and outlet reports",
      ]}
      benefits={[
        "Fewer billing errors",
        "Shorter kitchen wait times",
        "Lower stock leakage",
        "More repeat customer visits",
      ]}
      faqs={[
        {
          question: "Can I manage dine-in and delivery in one dashboard?",
          answer:
            "Yes. pixaPOS brings all order channels into one system so the kitchen, billing, and reporting stay consistent even when customers order differently.",
        },
        {
          question: "Does it work offline during internet issues?",
          answer:
            "Yes. The platform is designed for local-first operations, so billing and kitchen workflows keep running while connectivity is unstable.",
        },
        {
          question: "Is it good for multi-outlet restaurant groups?",
          answer:
            "Absolutely. Central menu, pricing control, and consolidated reporting make it easier to manage several outlets without duplicating admin work.",
        },
      ]}
    />
  );
}
