"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import PageContainer from "@pixa/ui/layout/page-container";
import { Button, buttonVariants } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pixa/ui/base-ui/tabs";
import { cn } from "@pixa/ui/lib/utils";
import BasicInformationForm from "@/features/outlet/components/basic-information-form";
import ContactForm from "@/features/outlet/components/contact-form";
import AddressForm from "@/features/outlet/components/address-form";
import BusinessDetailsForm from "@/features/outlet/components/business-details-form";
import UpiAccountsManager from "@/features/outlet/components/upi-accounts-manager";
import { OutletTeamDialog } from "@/features/outlet/components/outlet-team-dialog";
import {
  outletKeys,
  outletProfileQueryOptions,
  resolveActiveOutlet,
  setActiveOutletId,
  outletsQueryOptions,
} from "@/features/outlet/api/queries";
import { getOrganizationLogo } from "@/features/outlet/api/service";
import { getQueryClient } from "@/lib/query-client";
import { toast } from "sonner";

type StationRow = { id: string; name: string; code: string; is_active: boolean };

/**
 * Outlet detail: the single editor for one explicit outlet id. Status
 * header, full profile tabs, kitchen stations summary, and team assignment.
 * The id comes from the URL — never from ambient terminal state.
 */
export default function OutletDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? (params.id[0] ?? "") : ((params.id as string) ?? "");
  const { data: outlet, isPending } = useQuery(outletProfileQueryOptions(id));
  const { data: outlets } = useQuery(outletsQueryOptions);
  const [teamOpen, setTeamOpen] = React.useState(false);
  const { data: orgLogo } = useQuery({
    queryKey: ["outlet", "org-logo"],
    queryFn: getOrganizationLogo,
  });
  const { data: stations } = useQuery({
    queryKey: [...outletKeys.all, "stations", id],
    queryFn: async (): Promise<{ stations: StationRow[] }> => {
      const res = await fetch(`/api/outlets/stations?outletId=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!res.ok) return { stations: [] };
      return (await res.json()) as { stations: StationRow[] };
    },
    staleTime: 30_000,
  });

  if (isPending) {
    return (
      <PageContainer pageTitle="Outlet" isLoading>
        <div />
      </PageContainer>
    );
  }

  if (!outlet) {
    return (
      <PageContainer
        pageTitle="Outlet not found"
        pageDescription="This outlet doesn't exist or belongs to another organization."
      >
        <Link
          href="/dashboard/settings/outlets"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to outlets
        </Link>
      </PageContainer>
    );
  }

  const resolved = resolveActiveOutlet(outlets ?? []);
  const isActiveHere = resolved === outlet.id;
  const logoUrl = orgLogo ?? (typeof outlet.logo_url === "string" ? outlet.logo_url : "") ?? "";

  return (
    <PageContainer
      pageTitle={outlet.name}
      pageDescription={`Outlet ${outlet.code} · ${outlet.is_active ? "Active" : "Inactive"}`}
      pageHeaderAction={
        <div className="flex gap-2">
          {!isActiveHere && outlet.is_active && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveOutletId(outlet.id);
                getQueryClient().invalidateQueries({ queryKey: outletKeys.list() });
                toast.success(`Switched this terminal to ${outlet.name}`);
              }}
            >
              Use here
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setTeamOpen(true)}>
            Team
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="legal">Legal & Tax</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="kitchen">Kitchen</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="space-y-6 pt-4">
          <BasicInformationForm
            outletId={outlet.id}
            initialData={{
              name: outlet.name,
              code: outlet.code,
              alias: outlet.alias ?? "",
              type: outlet.type,
              logo_url: logoUrl,
              is_active: outlet.is_active,
            }}
          />
          <ContactForm
            outletId={outlet.id}
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
            outletId={outlet.id}
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
            outletId={outlet.id}
            initialData={{
              legal_name: outlet.legal_name ?? "",
              pan: outlet.pan ?? "",
              gstin: outlet.gstin ?? "",
              fssai_number: outlet.fssai_number ?? "",
            }}
          />
        </TabsContent>
        <TabsContent value="payments" className="pt-4">
          <UpiAccountsManager outlet={outlet} />
        </TabsContent>
        <TabsContent value="kitchen" className="pt-4">
          <Card className="mx-auto w-full max-w-3xl">
            <CardHeader>
              <CardTitle className="text-left text-xl font-bold">Kitchen Stations</CardTitle>
            </CardHeader>
            <CardContent>
              {(stations?.stations ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stations yet — they are seeded automatically on outlet creation.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {(stations?.stations ?? []).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.code} · {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
        <div>ID: {outlet.id}</div>
        <div>Organization: {outlet.organization_id}</div>
        <div>Created: {new Date(outlet.created_at).toLocaleDateString()}</div>
        <div>Updated: {new Date(outlet.updated_at).toLocaleDateString()}</div>
      </div>

      {teamOpen && (
        <OutletTeamDialog
          outletId={outlet.id}
          outletName={outlet.name}
          onClose={() => setTeamOpen(false)}
        />
      )}
    </PageContainer>
  );
}
