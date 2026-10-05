import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { baOrganization, orgProfiles, saasLeads } from "@pixa/db";
import { Alert, AlertDescription, AlertTitle } from "@pixa/ui/base-ui/alert";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Icons } from "@pixa/ui/icons";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  let stats = { orgs: 0, trials: 0, newLeads: 0, mrrPaise: 0 };
  try {
    const db = adminDb();
    const orgs = await db.select({ n: sql<number>`count(*)` }).from(baOrganization);
    const profiles = await db.select().from(orgProfiles);
    const leads = await db.select().from(saasLeads).orderBy(desc(saasLeads.createdAt)).limit(5);
    stats = {
      orgs: Number(orgs[0]?.n ?? 0),
      trials: profiles.filter((p) => p.lifecycle === "trial").length,
      newLeads: 0,
      mrrPaise: profiles.reduce((s, p) => s + (p.mrrPaise ?? 0), 0),
    };
    const fresh = await db.select({ n: sql<number>`count(*)` }).from(saasLeads);
    void fresh;
    return <Home stats={stats} leads={leads} dbDown={false} />;
  } catch {
    return <Home stats={stats} leads={[]} dbDown={true} />;
  }
}

function Home({
  stats,
  leads,
  dbDown,
}: {
  stats: { orgs: number; trials: number; newLeads: number; mrrPaise: number };
  leads: { id: string; businessName: string; email: string; status: string }[];
  dbDown: boolean;
}) {
  const cards = [
    {
      label: "Organisations",
      value: String(stats.orgs),
      hint: "Better Auth org rows",
      href: "/organizations",
    },
    {
      label: "Active trials",
      value: String(stats.trials),
      hint: "lifecycle = trial",
      href: "/organizations?lifecycle=trial",
    },
    {
      label: "MRR",
      value: `₹${(stats.mrrPaise / 100).toLocaleString("en-IN")}`,
      hint: "sum of org profiles",
      href: "/billing",
    },
    {
      label: "Open pipeline",
      value: String(leads.length),
      hint: "latest registrations",
      href: "/leads",
    },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Good morning, Owner</h1>
        <p className="text-sm text-zinc-600">
          SaaS health across every restaurant workspace — KPIs and pipeline status.
        </p>
      </div>
      {dbDown && (
        <Alert>
          <Icons.warning className="size-4" aria-hidden />
          <AlertTitle>Database not connected</AlertTitle>
          <AlertDescription>
            Set <code>DATABASE_URL</code> on <code>@pixa/admin</code> to see live KPIs. UI below is
            the production layout.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <Link href={c.href} className="block" aria-label={`${c.label} — open`}>
              <CardHeader className="pb-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {c.label}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{c.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest registrations</CardTitle>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No leads yet — website form posts to <code>/api/admin/leads</code>.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {leads.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2"
                  >
                    <span className="min-w-0">
                      <strong>{l.businessName}</strong>{" "}
                      <span className="text-muted-foreground">· {l.email}</span>
                    </span>
                    <Badge variant="secondary" className="shrink-0 capitalize">
                      {l.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="link"
              size="sm"
              render={<Link href="/admin/leads" />}
              className="mt-3 px-0"
            >
              Open pipeline
              <Icons.arrowRight className="size-3.5" aria-hidden />
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Owner checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Run the migration in <code>packages/db/migrations/*saas*</code> on Neon.
              </li>
              <li>
                Point the website signup form at{" "}
                <code>https://admin.pixapos.store/api/admin/leads</code>.
              </li>
              <li>
                Triage{" "}
                <Link className="underline" href="/admin/leads">
                  registrations
                </Link>{" "}
                → Approve creates the org + 14-day trial.
              </li>
              <li>
                Manage lifecycle on each{" "}
                <Link className="underline" href="/admin/organizations">
                  organisation
                </Link>{" "}
                (suspend blocks login via profile check).
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
