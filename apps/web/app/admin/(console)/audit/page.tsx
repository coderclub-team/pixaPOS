import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { saasAudit } from "@pixa/db";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";

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
      .limit(100)) as typeof rows;
  } catch {
    dbDown = true;
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Append-only trail of owner actions: lead triage, org creation, lifecycle changes.
        </p>
      </div>
      {dbDown || rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{dbDown ? "Database not connected" : "No audit events yet"}</EmptyTitle>
                {dbDown && (
                  <EmptyDescription>Set DATABASE_URL to review the trail.</EmptyDescription>
                )}
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.action}</TableCell>
                  <TableCell className="text-xs">
                    {r.entityType}/{String(r.entityId).slice(0, 12)}…
                  </TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                    {r.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
