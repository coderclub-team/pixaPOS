import Link from "next/link";
import { Suspense } from "react";
import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { baMember, baOrganization, orgProfiles } from "@pixa/db";
import { Button } from "@pixa/ui/base-ui/button";
import { Badge } from "@pixa/ui/base-ui/badge";
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
import { Icons } from "@pixa/ui/icons";
import { OrgFilters, ReviewRegistrationsButton } from "./filters";

export const dynamic = "force-dynamic";

type Search = { q?: string; lifecycle?: string };

async function load(search: Search) {
  try {
    const db = adminDb();
    const orgs = await db
      .select()
      .from(baOrganization)
      .orderBy(desc(baOrganization.createdAt))
      .limit(200);
    const profiles = await db.select().from(orgProfiles);
    const pmap = new Map(profiles.map((p) => [p.organizationId, p]));
    const members = await db.select().from(baMember);
    const counts = new Map<string, number>();
    for (const m of members) counts.set(m.organizationId, (counts.get(m.organizationId) ?? 0) + 1);
    const q = (search.q ?? "").toLowerCase();
    return orgs
      .map((o) => ({ ...o, profile: pmap.get(o.id) ?? null, seats: counts.get(o.id) ?? 0 }))
      .filter((o) => {
        if (search.lifecycle && (o.profile?.lifecycle ?? "trial") !== search.lifecycle)
          return false;
        if (q && !`${o.name} ${o.slug}`.toLowerCase().includes(q)) return false;
        return true;
      });
  } catch {
    return null;
  }
}

export default async function OrgsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const rows = await load(sp);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organisations</h1>
          <p className="text-sm text-muted-foreground">
            Every website registration becomes a lead first; approved leads become an organisation
            (Better Auth row + lifecycle profile) below.
          </p>
        </div>
        <ReviewRegistrationsButton />
      </div>

      <Suspense>
        <OrgFilters />
      </Suspense>

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
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No organisations match</EmptyTitle>
                <EmptyDescription>Try widening the search or clearing the filter.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.slug} · {o.id.slice(0, 8)}…
                    </p>
                  </TableCell>
                  <TableCell>
                    <LifecycleBadge value={o.profile?.lifecycle ?? "trial"} />
                  </TableCell>
                  <TableCell className="capitalize">{o.profile?.plan ?? "starter"}</TableCell>
                  <TableCell>{o.seats}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/admin/organizations/${o.id}`} />}
                    >
                      Open
                      <Icons.arrowRight className="size-3.5" aria-hidden />
                    </Button>
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

const LIFECYCLE_TONE: Record<
  string,
  "default" | "secondary" | "outline" | "destructive" | "ghost"
> = {
  trial: "secondary",
  active: "default",
  past_due: "outline",
  suspended: "destructive",
  churned: "ghost",
};

export function LifecycleBadge({ value }: { value: string }) {
  return (
    <Badge variant={LIFECYCLE_TONE[value] ?? "secondary"} className="capitalize">
      {value.replace("_", " ")}
    </Badge>
  );
}
