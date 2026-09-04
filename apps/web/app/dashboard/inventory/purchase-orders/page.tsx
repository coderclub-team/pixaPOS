"use client";
import PageContainer from "@/components/layout/page-container";
import { PurchaseOrderList } from "@/features/inventory/components/purchase-order-list";
import { purchaseOrdersQueryOptions } from "@/features/inventory/api/queries";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import Link from "next/link";
import { Protect } from "@clerk/nextjs";

export default function PurchaseOrdersPage() {
  const { data: orders, isPending } = useQuery(purchaseOrdersQueryOptions());
  if (isPending)
    return (
      <PageContainer
        pageTitle="Purchase Orders"
        pageDescription="Inventory — Purchase Orders"
        isLoading
      >
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Purchase Orders"
      pageDescription="Inventory — POs to replenish stock. Draft → Sent → Received (auto increments stock and updates avg cost)."
      pageHeaderAction={
        <Protect permission="org:purchases:manage" fallback={null}>
          <Link
            href="/dashboard/inventory/purchase-orders/new"
            className={cn(buttonVariants(), "text-xs md:text-sm")}
          >
            <Icons.add className="mr-2 h-4 w-4" /> New PO
          </Link>
        </Protect>
      }
    >
      <PurchaseOrderList orders={orders ?? []} />
    </PageContainer>
  );
}
