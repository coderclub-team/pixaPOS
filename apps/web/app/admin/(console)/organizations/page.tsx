import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { baMember, baOrganization, orgProfiles } from "@pixa/db";

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
  const lifecycles = ["trial", "active", "past_due", "suspended", "churned"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organisations</h1>
          <p className="text-sm text-zinc-600">
            Every website registration becomes a lead first; approved leads become an organisation
            (Better Auth row + lifecycle profile). Zoho/Odoo-style pipeline below.
          </p>
        </div>
        <a
          href="/admin/leads"
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Review registrations
        </a>
      </div>

      <form className="flex flex-wrap gap-2 rounded-xl border bg-white p-3" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name or slug…"
          className="min-w-52 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <select
          name="lifecycle"
          defaultValue={sp.lifecycle ?? ""}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">All lifecycles</option>
          {lifecycles.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-zinc-50">
          Filter
        </button>
      </form>

      {!rows ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          <p className="font-medium text-zinc-900">Database not connected</p>
          <p className="mt-1">
            Set <code>DATABASE_URL</code> on this app to list live organisations.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-zinc-600">
          No organisations match.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Lifecycle</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Seats</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-zinc-500">
                      {o.slug} · {o.id.slice(0, 8)}…
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <LifecycleBadge value={o.profile?.lifecycle ?? "trial"} />
                  </td>
                  <td className="px-4 py-3 capitalize">{o.profile?.plan ?? "starter"}</td>
                  <td className="px-4 py-3">{o.seats}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {new Date(o.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/organizations/${o.id}`}
                      className="font-medium text-zinc-900 underline underline-offset-2"
                    >
                      Open →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function LifecycleBadge({ value }: { value: string }) {
  const tone: Record<string, string> = {
    trial: "bg-sky-100 text-sky-800",
    active: "bg-emerald-100 text-emerald-800",
    past_due: "bg-amber-100 text-amber-800",
    suspended: "bg-red-100 text-red-800",
    churned: "bg-zinc-200 text-zinc-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tone[value] ?? "bg-zinc-100"}`}
    >
      {value.replace("_", " ")}
    </span>
  );
}
