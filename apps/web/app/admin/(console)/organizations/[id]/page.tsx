import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/saas-admin";
import {
  baInvitation,
  baMember,
  baOrganization,
  orgProfiles,
  saasAudit,
  saasPlans,
} from "@pixa/db";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import { Icons } from "@pixa/ui/icons";
import PageContainer from "@/components/layout/page-container";
import { LifecycleBadge } from "../page";
import { OrgActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function OrgDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let org,
    profile,
    members: unknown[] = [],
    invites: unknown[] = [],
    plans: { id: string; name: string }[] = [];
  try {
    const db = adminDb();
    const rows = await db.select().from(baOrganization).where(eq(baOrganization.id, id));
    org = rows[0];
    if (!org) notFound();
    profile =
      (await db.select().from(orgProfiles).where(eq(orgProfiles.organizationId, id)))[0] ?? null;
    members = await db.select().from(baMember).where(eq(baMember.organizationId, id));
    invites = await db.select().from(baInvitation).where(eq(baInvitation.organizationId, id));
    plans = (await db.select({ id: saasPlans.id, name: saasPlans.name }).from(saasPlans)).map(
      (p) => ({ id: p.id, name: p.name }),
    );
  } catch {
    return (
      <PageContainer pageTitle="Organisation">
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Database not connected</EmptyTitle>
                <EmptyDescription>
                  Set <code>DATABASE_URL</code> to inspect this organisation.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle={org!.name}
      pageDescription={`${org!.slug} · created ${new Date(org!.createdAt).toLocaleString("en-IN")}`}
      pageHeaderAction={<OrgActions id={org!.id} profile={profile} plans={plans} />}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/admin/organizations" />}
            className="px-0"
          >
            <Icons.chevronLeft className="size-3.5" aria-hidden />
            All organisations
          </Button>
          <div className="flex gap-2">
            <LifecycleBadge value={profile?.lifecycle ?? "trial"} />
            <Badge variant="secondary" className="capitalize">
              {profile?.plan ?? "starter"} plan
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Members
              </p>
              <p className="mt-1 text-2xl font-semibold">{members.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Pending invites
              </p>
              <p className="mt-1 text-2xl font-semibold">{invites.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                MRR
              </p>
              <p className="mt-1 text-2xl font-semibold">
                ₹{((profile?.mrrPaise ?? 0) / 100).toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Owner & subscription notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Owner: {profile?.ownerEmail ?? "—"} · Trial ends:{" "}
              {profile?.trialEndsAt
                ? new Date(profile.trialEndsAt).toLocaleDateString("en-IN")
                : "—"}
            </p>
            {profile?.notes && <p className="mt-2 text-sm">{profile.notes}</p>}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

export { saasAudit };
