import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shop",
  description: "Restaurant e-commerce — reserved for the upcoming online store.",
};

/**
 * /shop placeholder (public): this route is reserved for the restaurant
 * e-commerce storefront. Online ordering today runs at /order.
 */
export default async function ShopPlaceholderPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-bold">Shop — coming soon</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        This route is reserved for the online store. Ordering today runs at /order.
      </p>
      <Link
        href="/order"
        className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Order online
      </Link>
    </div>
  );
}
