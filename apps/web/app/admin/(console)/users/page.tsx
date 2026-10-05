import { adminDb } from "@/lib/saas-admin";
import { saasOwnerRoles, saasOwners } from "@pixa/db";
import { OwnerActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function OwnerUsersPage() {
  let owners: Omit<typeof saasOwners.$inferSelect, "passwordHash">[] = [];
  let roles: { id: string; name: string }[] = [];
  let dbDown = false;
  try {
    const db = adminDb();
    const rows = await db.select().from(saasOwners).orderBy(saasOwners.createdAt);
    owners = rows.map(({ passwordHash: _drop, ...rest }) => rest);
    roles = (
      await db.select({ id: saasOwnerRoles.id, name: saasOwnerRoles.name }).from(saasOwnerRoles)
    ).map((r) => ({ id: r.id, name: r.name }));
  } catch {
    dbDown = true;
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Owner users</h1>
        <p className="text-sm text-zinc-600">
          Singleton super owner + scoped staff. Separate identity plane from restaurant users —
          these credentials never work on the app, and app credentials never work here.
        </p>
      </div>
      {dbDown ? (
        <p className="rounded-xl border bg-white p-8 text-sm">Database not connected.</p>
      ) : (
        <OwnerActions owners={owners} roles={roles} />
      )}
    </div>
  );
}
