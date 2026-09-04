"use client";

import PageContainer from "@/components/layout/page-container";
import ContactForm from "@/features/outlet/components/contact-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";

export default function ContactPage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet)
    return (
      <PageContainer pageTitle="Contact" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer pageTitle="Contact" pageDescription="Outlet — General contact">
      <ContactForm
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
