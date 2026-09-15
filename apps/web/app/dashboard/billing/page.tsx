"use client";

import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@clerk/nextjs";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { billingKeys } from "@/features/billing/api/queries";
import { getQueryClient } from "@/lib/query-client";
import BillingView from "@/features/billing/components/billing-view";
import { billingInfoContent } from "@/config/infoconfig";

export default function BillingPage() {
  const { organization, isLoaded } = useOrganization();
  const { data: outlet, isPending } = useQuery(outletQueryOptions);

  if (isPending || !isLoaded) {
    return (
      <PageContainer pageTitle="Billing" pageDescription="Sales — Billing" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Billing"
      pageDescription="Subscription, 14-day trial, payment method and billing history for this outlet."
      infoContent={billingInfoContent}
      access={!!organization}
      accessFallback={
        <div className="text-center text-muted-foreground">
          Billing is managed per organization. Create or select an organization to continue.
        </div>
      }
      pageHeaderAction={
        outlet ? (
          <Button
            variant="outline"
            size="sm"
            title="Refresh billing"
            onClick={() => {
              getQueryClient().invalidateQueries({ queryKey: billingKeys.subscription(outlet.id) });
              getQueryClient().invalidateQueries({ queryKey: billingKeys.invoices(outlet.id) });
            }}
          >
            <Icons.refresh className="size-4" />
          </Button>
        ) : undefined
      }
    >
      {outlet ? (
        <BillingView
          outletId={outlet.id}
          outletName={outlet.name}
          orgCreatedAt={organization?.createdAt?.getTime()}
        />
      ) : (
        <div className="text-center text-sm text-muted-foreground">Outlet not found.</div>
      )}
    </PageContainer>
  );
}
