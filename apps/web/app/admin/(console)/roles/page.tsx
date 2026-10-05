import { adminDb } from "@/lib/saas-admin";
import { saasOwnerRoles } from "@pixa/db";
import { parsePermissions } from "@/lib/saas-owner";
import { RolesManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function OwnerRolesPage() {
  let roles: { id: string; name: string; permissions: string[] }[] = [];
  let vocabulary: string[] = [];
  let dbDown = false;
  try {
    const db = adminDb();
    const rows = await db.select().from(saasOwnerRoles).orderBy(saasOwnerRoles.name);
    roles = rows.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: parsePermissions(r.permissions),
    }));
    const { SAAS_PERMISSIONS } = await import("@/lib/saas-owner");
    vocabulary = [...SAAS_PERMISSIONS];
  } catch {
    dbDown = true;
  }
  // Seed two starter roles on first visit (idempotent, super-owner session required by layout).
  if (!dbDown && roles.length === 0) {
    try {
      const { uid } = await import("@/lib/saas-admin");
      const db = adminDb();
      await db.insert(saasOwnerRoles).values([
        {
          id: uid("srole"),
          name: "Support",
          permissions: JSON.stringify(["leads:read", "orgs:read", "audit:read"]),
        },
        {
          id: uid("srole"),
          name: "Billing",
          permissions: JSON.stringify(["billing:read", "billing:mrr", "orgs:read", "audit:read"]),
        },
      ]);
      const rows = await db.select().from(saasOwnerRoles).orderBy(saasOwnerRoles.name);
      roles = rows.map((r) => ({
        id: r.id,
        name: r.name,
        permissions: parsePermissions(r.permissions),
      }));
    } catch {
      /* seed is best-effort */
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owner roles</h1>
        <p className="text-sm text-zinc-600">
          Scoped permissions for owner-created staff. Zoho-style custom admins — each role sees only
          its surfaces. The super owner always holds every permission.
        </p>
      </div>
      {dbDown ? (
        <p className="rounded-xl border bg-white p-8 text-sm">Database not connected.</p>
      ) : (
        <RolesManager initialRoles={roles} vocabulary={vocabulary} />
      )}
    </div>
  );
}
