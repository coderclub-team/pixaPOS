"use client";

import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pixa/ui/base-ui/tabs";
import { Icons } from "@pixa/ui/icons";
import { useIdentity } from "@/hooks/use-identity";
import { billingKeys } from "@/features/billing/api/queries";
import { getQueryClient } from "@/lib/query-client";
import BillingView from "@/features/billing/components/billing-view";
import { UsageLimitsPanel } from "@/components/billing/usage-limits";
import { billingInfoContent } from "@/config/infoconfig";

export default function BillingPage() {
  const { organization, loaded } = useIdentity();

  if (!loaded) {
    return (
      <PageContainer pageTitle="Billing" pageDescription="Sales — Billing" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Billing"
      pageDescription="Subscription, 14-day trial, payment method and billing history for this organization."
      infoContent={billingInfoContent}
      access={!!organization}
      accessFallback={
        <div className="text-center text-muted-foreground">
          Billing is managed per organization. Create or select an organization to continue.
        </div>
      }
      pageHeaderAction={
        organization ? (
          <Button
            variant="outline"
            size="sm"
            title="Refresh billing"
            onClick={() => {
              getQueryClient().invalidateQueries({
                queryKey: billingKeys.subscription(organization.id),
              });
              getQueryClient().invalidateQueries({
                queryKey: billingKeys.invoices(organization.id),
              });
            }}
          >
            <Icons.refresh className="size-4" />
          </Button>
        ) : undefined
      }
    >
      {organization ? (
        <div className="mx-auto w-full max-w-4xl">
          <Tabs defaultValue="billing">
            <TabsList>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="usage">Usage &amp; limits</TabsTrigger>
            </TabsList>
            <TabsContent value="billing" keepMounted className="pt-4">
              <BillingView
                organizationId={organization.id}
                organizationName={organization.name}
                orgCreatedAt={
                  organization?.createdAt == null
                    ? undefined
                    : new Date(organization.createdAt).getTime()
                }
              />
            </TabsContent>
            <TabsContent value="usage" keepMounted className="pt-4">
              <UsageLimitsPanel />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground">Organization not found.</div>
      )}
    </PageContainer>
  );
}
