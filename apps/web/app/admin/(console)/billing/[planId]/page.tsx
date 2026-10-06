import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/saas-admin";
import { saasPlans } from "@pixa/db";
import { resolveLimits, type LimitMap } from "@pixa/db/plans";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import PageContainer from "@/components/layout/page-container";
import { PlanForm, type EditablePlan } from "./form";

export const dynamic = "force-dynamic";

function parseFeatures(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

export default async function EditPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  let plan: EditablePlan | null = null;
  let dbDown = false;
  try {
    const row = (await adminDb().select().from(saasPlans).where(eq(saasPlans.id, planId)))[0];
    if (row) {
      let dbLimits: Partial<LimitMap> | null = null;
      try {
        dbLimits = row.limits ? (JSON.parse(row.limits) as Partial<LimitMap>) : null;
      } catch {
        dbLimits = null;
      }
      plan = {
        id: row.id,
        name: row.name,
        tagline: row.tagline,
        monthlyPaise: row.monthlyPaise,
        annualDiscountPct: row.annualDiscountPct,
        sortOrder: row.sortOrder,
        features: parseFeatures(row.features),
        limits: resolveLimits(row.id, dbLimits),
      };
    }
  } catch {
    dbDown = true;
  }

  if (dbDown) {
    return (
      <PageContainer pageTitle="Edit plan">
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Database not connected</EmptyTitle>
                <EmptyDescription>Set DATABASE_URL to edit plans.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }
  if (!plan) notFound();

  return (
    <PageContainer
      pageTitle={`Edit plan — ${plan.name}`}
      pageDescription="Pricing, usage limits and features. Saved to the catalog and applied to new signups."
    >
      <div className="mx-auto w-full max-w-3xl">
        <PlanForm plan={plan} />
      </div>
    </PageContainer>
  );
}
