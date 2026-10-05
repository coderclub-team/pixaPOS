import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import {
  auditOwnerAction,
  parsePermissions,
  requireOwnerApi,
  SAAS_PERMISSIONS,
} from "@/lib/saas-owner";
import { saasOwnerRoles } from "@pixa/db";

export const dynamic = "force-dynamic";

/** List scoped roles + the permission vocabulary. */
export async function GET() {
  const auth = await requireOwnerApi(["owners:manage"]);
  if ("response" in auth) return auth.response;
  try {
    const rows = await adminDb().select().from(saasOwnerRoles).orderBy(asc(saasOwnerRoles.name));
    return NextResponse.json({
      ok: true,
      roles: rows.map((r) => ({ ...r, permissions: parsePermissions(r.permissions) })),
      vocabulary: [...SAAS_PERMISSIONS],
    });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

/** Create a scoped role (super owners only). */
export async function POST(req: Request) {
  const auth = await requireOwnerApi(["owners:manage"]);
  if ("response" in auth) return auth.response;
  if (!auth.owner.isSuper) {
    return NextResponse.json({ ok: false, error: "super owner only" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "")
    .trim()
    .slice(0, 60);
  const permissions = Array.isArray(body?.permissions)
    ? body.permissions.filter(
        (p: unknown): p is (typeof SAAS_PERMISSIONS)[number] =>
          typeof p === "string" && (SAAS_PERMISSIONS as readonly string[]).includes(p),
      )
    : null;
  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  if (!permissions) {
    return NextResponse.json({ ok: false, error: "permissions must be an array" }, { status: 400 });
  }
  try {
    const db = adminDb();
    const id = uid("srole");
    await db.insert(saasOwnerRoles).values({
      id,
      name,
      permissions: JSON.stringify(permissions),
    });
    await auditOwnerAction(auth.owner, "role", id, "ROLE_CREATED", name);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
