import { desc, sql } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { baOrganization, orgProfiles, saasLeads } from "@pixa/db";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  let stats = { orgs: 0, trials: 0, newLeads: 0, mrrPaise: 0 };
  let dbDown = false;
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
    return <Home stats={stats} leads={[]} dbDown />;
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
        <h1 className="text-2xl font-semibold tracking-tight">Good morning, Owner 👋</h1>
        <p className="text-sm text-zinc-600">
          SaaS health across every restaurant workspace — Zoho-style KPIs, Odoo-style pipeline.
        </p>
      </div>
      {dbDown && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Database not connected</p>
          <p className="text-amber-800">
            Set <code>DATABASE_URL</code> on <code>@pixa/admin</code> to see live KPIs. UI below is
            the production layout.
          </p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <a key={c.label} href={c.href} className="rounded-xl border bg-white p-4 hover:shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{c.hint}</p>
          </a>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Latest registrations</h2>
          {leads.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              No leads yet — website form posts to <code>/api/admin/leads</code>.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {leads.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2"
                >
                  <span>
                    <strong>{l.businessName}</strong>{" "}
                    <span className="text-zinc-500">· {l.email}</span>
                  </span>
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs capitalize">
                    {l.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <a
            href="/leads"
            className="mt-3 inline-block text-sm font-medium underline underline-offset-2"
          >
            Open pipeline →
          </a>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Owner checklist</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
            <li>
              Run the migration in <code>packages/db/migrations/*saas*</code> on Neon.
            </li>
            <li>
              Point the website signup form at{" "}
              <code>https://admin.pixapos.store/api/admin/leads</code>.
            </li>
            <li>
              Triage{" "}
              <a className="underline" href="/leads">
                registrations
              </a>{" "}
              → Approve creates the org + 14-day trial.
            </li>
            <li>
              Manage lifecycle on each{" "}
              <a className="underline" href="/organizations">
                organisation
              </a>{" "}
              (suspend blocks login via profile check).
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
