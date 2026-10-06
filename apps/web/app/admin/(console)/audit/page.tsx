import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { saasAudit } from "@pixa/db";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import PageContainer from "@/components/layout/page-container";
import { AuditTable } from "./table";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  let rows: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    detail: string | null;
    createdAt: Date;
  }[] = [];
  let dbDown = false;
  try {
    rows = (await adminDb()
      .select()
      .from(saasAudit)
      .orderBy(desc(saasAudit.createdAt))
      .limit(500)) as typeof rows;
  } catch {
    dbDown = true;
  }
  return (
    <PageContainer
      pageTitle="Audit log"
      pageDescription="Append-only trail of owner actions: lead triage, org creation, lifecycle changes."
    >
      {dbDown ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Database not connected</EmptyTitle>
                <EmptyDescription>Set DATABASE_URL to review the trail.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <AuditTable initial={rows} />
      )}
    </PageContainer>
  );
}
