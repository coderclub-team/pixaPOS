import Link from "next/link";
import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { saasLeads } from "@pixa/db";
import { Button } from "@pixa/ui/base-ui/button";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import PageContainer from "@/components/layout/page-container";
import { LeadActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  let rows: Awaited<ReturnType<typeof fetchLeads>> = [];
  let dbDown = false;
  try {
    rows = await fetchLeads();
  } catch {
    dbDown = true;
  }
  const filtered = status ? rows.filter((r) => r.status === status) : rows;
  const counts = Object.fromEntries(
    ["new", "contacted", "trial", "converted", "rejected"].map((s) => [
      s,
      rows.filter((r) => r.status === s).length,
    ]),
  );

  return (
    <PageContainer
      pageTitle="Website registrations"
      pageDescription="Public form POST /api/admin/leads writes here. Triage each lead, then Approve creates the Better Auth organisation (slug-unique, owner member, trial profile)."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2 text-sm">
          <FilterPill href="/admin/leads" active={!status} label={`All (${rows.length})`} />
          {Object.entries(counts).map(([s, n]) => (
            <FilterPill
              key={s}
              href={`/admin/leads?status=${s}`}
              active={status === s}
              label={`${s} (${n})`}
            />
          ))}
        </div>
        {dbDown ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Database not connected</EmptyTitle>
                  <EmptyDescription>
                    Set DATABASE_URL to review live registrations.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No registrations</EmptyTitle>
                  <EmptyDescription>
                    New website signups will appear here with contact, city and planned outlets.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((l) => (
              <Card key={l.id}>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{l.businessName}</p>
                      <p className="text-sm text-muted-foreground">
                        {l.contactName} · {l.email} · {l.phone}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {l.city ?? "—"} · {l.outletsPlanned} outlet(s) · {l.source} ·{" "}
                        {new Date(l.createdAt).toLocaleString("en-IN")}
                      </p>
                      {l.notes && <p className="mt-2 text-sm">{l.notes}</p>}
                    </div>
                    <StatusPill status={l.status} />
                  </div>
                  <LeadActions lead={l} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

async function fetchLeads() {
  const db = adminDb();
  return db.select().from(saasLeads).orderBy(desc(saasLeads.createdAt)).limit(200);
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Button
      nativeButton={false}
      variant={active ? "default" : "outline"}
      size="sm"
      render={<Link href={href} />}
    >
      <span className="capitalize">{label}</span>
    </Button>
  );
}

const STATUS_TONE: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
  new: "secondary",
  contacted: "outline",
  trial: "default",
  converted: "default",
  rejected: "destructive",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_TONE[status] ?? "secondary"} className="capitalize">
      {status}
    </Badge>
  );
}
