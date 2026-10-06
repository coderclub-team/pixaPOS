import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import {
  auditOwnerAction,
  parsePermissions,
  requireOwnerApi,
  SAAS_PERMISSIONS,
} from "@/lib/saas-owner";
import { saasOwnerRoles, saasOwners } from "@pixa/db";

/** Edit a scoped role's name/permissions (super owners only). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi(["owners:manage"]);
  if ("response" in auth) return auth.response;
  if (!auth.owner.isSuper) {
    return NextResponse.json({ ok: false, error: "super owner only" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (body?.name !== undefined) {
    const name = String(body.name).trim().slice(0, 60);
    if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
    patch.name = name;
  }
  if (body?.permissions !== undefined) {
    if (!Array.isArray(body.permissions)) {
      return NextResponse.json(
        { ok: false, error: "permissions must be an array" },
        { status: 400 },
      );
    }
    patch.permissions = JSON.stringify(
      body.permissions.filter(
        (p: unknown): p is (typeof SAAS_PERMISSIONS)[number] =>
          typeof p === "string" && (SAAS_PERMISSIONS as readonly string[]).includes(p),
      ),
    );
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });
  }
  try {
    const db = adminDb();
    await db.update(saasOwnerRoles).set(patch).where(eq(saasOwnerRoles.id, id));
    await auditOwnerAction(
      auth.owner,
      "role",
      id,
      "ROLE_UPDATED",
      JSON.stringify({
        ...patch,
        permissions: patch.permissions ? parsePermissions(patch.permissions as string) : undefined,
      }).slice(0, 500),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

/**
 * Delete a role only when no owner holds it (deactivate owners first).
 * There is no delete for owners — deactivate instead (history preserved).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi(["owners:manage"]);
  if ("response" in auth) return auth.response;
  if (!auth.owner.isSuper) {
    return NextResponse.json({ ok: false, error: "super owner only" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const db = adminDb();
    const holders = await db
      .select({ id: saasOwners.id })
      .from(saasOwners)
      .where(eq(saasOwners.roleId, id))
      .limit(1);
    if (holders.length > 0) {
      return NextResponse.json(
        { ok: false, error: "role in use — reassign owners first" },
        { status: 409 },
      );
    }
    await db.delete(saasOwnerRoles).where(eq(saasOwnerRoles.id, id));
    await auditOwnerAction(auth.owner, "role", id, "ROLE_DELETED");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
