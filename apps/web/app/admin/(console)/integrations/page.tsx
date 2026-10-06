import { asc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { msgProviders } from "@pixa/db";
import { maskConfig } from "@/lib/messaging-providers";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import PageContainer from "@/components/layout/page-container";
import { IntegrationsConsole } from "./console";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  let providers: Awaited<ReturnType<typeof fetchProviders>> = [];
  let dbDown = false;
  try {
    providers = await fetchProviders();
  } catch {
    dbDown = true;
  }
  return (
    <PageContainer
      pageTitle="Integrations"
      pageDescription="WhatsApp, SMS, email, Meta and Google Ads providers. Secrets are masked everywhere — re-enter a value to rotate it, blank keeps the stored one. Test before activating."
    >
      {dbDown ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Database not connected</EmptyTitle>
                <EmptyDescription>Set DATABASE_URL to manage integrations.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <IntegrationsConsole initialProviders={providers} />
      )}
    </PageContainer>
  );
}

async function fetchProviders() {
  const rows = await adminDb().select().from(msgProviders).orderBy(asc(msgProviders.channel));
  return rows.map((p) => ({
    ...p,
    config: maskConfig(JSON.parse(p.config ?? "{}") as Record<string, string>),
  }));
}
