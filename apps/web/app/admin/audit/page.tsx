import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { saasAudit } from "@pixa/db";

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
        <p className="text-sm text-zinc-600">
          Append-only trail of owner actions: lead triage, org creation, lifecycle changes.
        </p>
      </div>
      {dbDown ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-zinc-600">
          Database not connected.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-zinc-600">
          No audit events yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2 text-zinc-600">
                    {new Date(r.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.entityType}/{String(r.entityId).slice(0, 12)}…
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-600">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
