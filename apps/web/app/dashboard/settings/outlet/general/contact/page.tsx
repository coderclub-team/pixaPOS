"use client";

import PageContainer from "@pixa/ui/layout/page-container";
import ContactForm from "@/features/outlet/components/contact-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";
import { useActiveOutletId } from "@/hooks/use-active-outlet";
import { OutletRequiredCallout } from "@/components/outlet-required-callout";

export default function ContactPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  const activeOutletId = useActiveOutletId();
  if (isPending)
    return (
      <PageContainer pageTitle="Contact" isLoading>
        <div />
      </PageContainer>
    );
  if (!outlet || !activeOutletId)
    return (
      <PageContainer pageTitle="Contact">
        <div className="mx-auto w-full max-w-3xl py-6">
          <OutletRequiredCallout what="Outlet settings" />
        </div>
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="Contact" pageDescription="Outlet — General contact">
      <ContactForm
        outletId={activeOutletId ?? outlet.id}
        initialData={{
          phone: outlet.phone,
          alternate_phone: outlet.alternate_phone ?? "",
          email: outlet.email,
          website: outlet.website ?? "",
          whatsapp: outlet.whatsapp ?? "",
        }}
      />
    </PageContainer>
  );
}
