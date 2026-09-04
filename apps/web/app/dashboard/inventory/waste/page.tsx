"use client";
import PageContainer from "@/components/layout/page-container";
import { WasteList } from "@/features/inventory/components/waste-list";
import { wasteQueryOptions } from "@/features/inventory/api/queries";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import Link from "next/link";
import { Protect } from "@clerk/nextjs";

export default function WastePage() {
  const { data: logs, isPending } = useQuery(wasteQueryOptions());
  if (isPending)
    return (
      <PageContainer pageTitle="Waste Log" pageDescription="Inventory — Food Wastage" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Waste Log"
      pageDescription="Inventory — Track spoilage, expired, overproduction, trimming, spillage. Cost loss auto-calculated and stock deducted."
      pageHeaderAction={
        <Protect permission="org:waste:manage" fallback={null}>
          <Link
            href="/dashboard/inventory/waste/new"
            className={cn(buttonVariants(), "text-xs md:text-sm")}
          >
            <Icons.add className="mr-2 h-4 w-4" /> Log Waste
          </Link>
        </Protect>
      }
    >
      <WasteList logs={logs ?? []} />
    </PageContainer>
  );
}
