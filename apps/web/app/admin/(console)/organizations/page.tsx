import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { baMember, baOrganization, orgProfiles } from "@pixa/db";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import { Icons } from "@pixa/ui/icons";
import Link from "next/link";
import PageContainer from "@/components/layout/page-container";
import { OrgList, type OrgRow } from "./org-list";

export const dynamic = "force-dynamic";

async function load(): Promise<OrgRow[] | null> {
  try {
    const db = adminDb();
    const orgs = await db
      .select()
      .from(baOrganization)
      .orderBy(desc(baOrganization.createdAt))
      .limit(500);
    const profiles = await db.select().from(orgProfiles);
    const pmap = new Map(profiles.map((p) => [p.organizationId, p]));
    const members = await db.select().from(baMember);
    const counts = new Map<string, number>();
    for (const m of members) counts.set(m.organizationId, (counts.get(m.organizationId) ?? 0) + 1);
    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      createdAt: o.createdAt,
      profile: pmap.get(o.id)
        ? { lifecycle: pmap.get(o.id)!.lifecycle, plan: pmap.get(o.id)!.plan }
        : null,
      seats: counts.get(o.id) ?? 0,
    }));
  } catch {
    return null;
  }
}

export default async function OrgsPage() {
  const rows = await load();

  return (
    <PageContainer
      pageTitle="Organisations"
      pageDescription="Every website registration becomes a lead first; approved leads become an organisation (Better Auth row + lifecycle profile) below."
      pageHeaderAction={
        <Button nativeButton={false} render={<Link href="/admin/leads" />}>
          Review registrations
          <Icons.arrowRight className="size-3.5" aria-hidden />
        </Button>
      }
    >
      {!rows ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Database not connected</EmptyTitle>
                <EmptyDescription>
                  Set <code>DATABASE_URL</code> on this app to list live organisations.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <OrgList initial={rows} />
      )}
    </PageContainer>
  );
}
