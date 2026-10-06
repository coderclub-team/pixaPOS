import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { baMember, baOrganization, orgProfiles, orgUsage, saasPlans } from "@pixa/db";
import { resolveLimits, type LimitMap } from "@pixa/db/plans";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import { Icons } from "@pixa/ui/icons";
import Link from "next/link";
import PageContainer from "@/components/layout/page-container";
import { OrgList, type OrgRow, type OrgUsageSummary } from "./org-list";

export const dynamic = "force-dynamic";

async function load(): Promise<{ rows: OrgRow[]; usage: Record<string, OrgUsageSummary> } | null> {
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

    // Plan limit maps (DB rows, fallback to seeded defaults).
    const planLimitMap = new Map<string, LimitMap>();
    try {
      for (const p of await db.select().from(saasPlans)) {
        try {
          planLimitMap.set(p.id, JSON.parse(p.limits) as LimitMap);
        } catch {
          /* ignore malformed */
        }
      }
    } catch {
      /* plans unavailable — defaults used below */
    }

    const usageRows = await db.select().from(orgUsage);
    const umap = new Map(usageRows.map((u) => [u.organizationId, u]));

    const usage: Record<string, OrgUsageSummary> = {};
    for (const o of orgs) {
      const profile = pmap.get(o.id);
      const overrides = (() => {
        try {
          return profile?.planOverrides
            ? (JSON.parse(profile.planOverrides) as Partial<LimitMap>)
            : null;
        } catch {
          return null;
        }
      })();
      const limits = { ...resolveLimits(profile?.plan ?? "starter", overrides) };
      if (planLimitMap.has(profile?.plan ?? "starter")) {
        for (const [k, v] of Object.entries(planLimitMap.get(profile?.plan ?? "starter")!)) {
          if (typeof v === "number" || v === null) (limits as Record<string, unknown>)[k] = v;
        }
      }
      const u = umap.get(o.id);
      usage[o.id] = {
        orders: u?.ordersCount ?? 0,
        ordersLimit: limits.orders ?? null,
        storageBytes: (u?.databaseStorageBytes ?? 0) + (u?.objectStorageBytes ?? 0),
        storageLimit: (limits.databaseStorage ?? 0) + (limits.objectStorage ?? 0) || null,
      };
    }

    return {
      rows: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        createdAt: o.createdAt,
        profile: pmap.get(o.id)
          ? { lifecycle: pmap.get(o.id)!.lifecycle, plan: pmap.get(o.id)!.plan }
          : null,
        seats: counts.get(o.id) ?? 0,
      })),
      usage,
    };
  } catch {
    return null;
  }
}

export default async function OrgsPage() {
  const data = await load();

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
      {!data ? (
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
        <OrgList initial={data.rows} usage={data.usage} />
      )}
    </PageContainer>
  );
}
