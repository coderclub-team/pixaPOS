import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/db";
import { saasLeads } from "@pixa/db";
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Website registrations</h1>
        <p className="text-sm text-zinc-600">
          Public form <code>POST /api/leads</code> writes here. Triage each lead, then
          <strong> Approve</strong> creates the Better Auth organisation (slug-unique, owner member,
          trial profile).
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <FilterPill href="/leads" active={!status} label={`All (${rows.length})`} />
        {Object.entries(counts).map(([s, n]) => (
          <FilterPill
            key={s}
            href={`/leads?status=${s}`}
            active={status === s}
            label={`${s} (${n})`}
          />
        ))}
      </div>
      {dbDown ? (
        <Empty
          title="Database not connected"
          body="Set DATABASE_URL to review live registrations."
        />
      ) : filtered.length === 0 ? (
        <Empty
          title="No registrations"
          body="New website signups will appear here with contact, city and planned outlets."
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((l) => (
            <div key={l.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{l.businessName}</p>
                  <p className="text-sm text-zinc-600">
                    {l.contactName} · {l.email} · {l.phone}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {l.city ?? "—"} · {l.outletsPlanned} outlet(s) · {l.source} ·{" "}
                    {new Date(l.createdAt).toLocaleString("en-IN")}
                  </p>
                  {l.notes && <p className="mt-2 text-sm">{l.notes}</p>}
                </div>
                <StatusPill status={l.status} />
              </div>
              <LeadActions lead={l} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function fetchLeads() {
  const db = adminDb();
  return db.select().from(saasLeads).orderBy(desc(saasLeads.createdAt)).limit(200);
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={`rounded-full border px-3 py-1 capitalize ${active ? "bg-zinc-950 text-white" : "bg-white hover:bg-zinc-50"}`}
    >
      {label}
    </a>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
      <p className="font-medium text-zinc-900">{title}</p>
      <p className="mt-1">{body}</p>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    new: "bg-sky-100 text-sky-800",
    contacted: "bg-amber-100 text-amber-800",
    trial: "bg-violet-100 text-violet-800",
    converted: "bg-emerald-100 text-emerald-800",
    rejected: "bg-zinc-200 text-zinc-600",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tone[status] ?? "bg-zinc-100"}`}
    >
      {status}
    </span>
  );
}
