"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import BasicInformationForm from "@/features/outlet/components/basic-information-form";
import ContactForm from "@/features/outlet/components/contact-form";
import AddressForm from "@/features/outlet/components/address-form";
import BusinessDetailsForm from "@/features/outlet/components/business-details-form";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pixa/ui/base-ui/tabs";

export default function OutletProfilePage() {
  const { data: outlet, isPending } = useQuery(outletQueryOptions);
  if (isPending || !outlet) {
    return (
      <PageContainer pageTitle="Outlet Profile" isLoading>
        <div />
      </PageContainer>
    );
  }
  return (
    <PageContainer
      pageTitle="Outlet Profile"
      pageDescription="Single outlet identity — Odoo Company / Zoho Organization Profile. General, Address, Legal & Tax tabs. Floors & Tables under Setup."
    >
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="legal">Legal & Tax</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="space-y-6 pt-4">
          <BasicInformationForm
            initialData={{
              name: outlet.name,
              code: outlet.code,
              alias: outlet.alias ?? "",
              type: outlet.type,
              logo_url: undefined,
              is_active: outlet.is_active,
            }}
          />
          <ContactForm
            initialData={{
              phone: (outlet as any).phone ?? "",
              alternate_phone: (outlet as any).alternate_phone ?? "",
              email: (outlet as any).email ?? "",
              website: (outlet as any).website ?? "",
              whatsapp: (outlet as any).whatsapp ?? "",
            }}
          />
        </TabsContent>
        <TabsContent value="address" className="pt-4">
          <AddressForm
            initialData={{
              address_line_1: (outlet as any).address_line_1 ?? "",
              address_line_2: (outlet as any).address_line_2 ?? "",
              locality: (outlet as any).locality ?? "",
              city: (outlet as any).city ?? "",
              district: (outlet as any).district ?? "",
              state: (outlet as any).state ?? "",
              country: (outlet as any).country ?? "",
              postal_code: (outlet as any).postal_code ?? "",
              latitude: (outlet as any).latitude ?? 0,
              longitude: (outlet as any).longitude ?? 0,
            }}
          />
        </TabsContent>
        <TabsContent value="legal" className="pt-4">
          <BusinessDetailsForm
            initialData={{
              legal_name: outlet.legal_name ?? "",
              pan: outlet.pan ?? "",
              gstin: outlet.gstin ?? "",
              fssai_number: outlet.fssai_number ?? "",
            }}
          />
        </TabsContent>
      </Tabs>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
        <div>ID: {outlet.id}</div>
        <div>Organization: {outlet.organization_id}</div>
        <div>Created: {new Date(outlet.created_at).toLocaleDateString()}</div>
        <div>Updated: {new Date(outlet.updated_at).toLocaleDateString()}</div>
      </div>
    </PageContainer>
  );
}
