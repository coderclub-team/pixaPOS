import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { auditOwnerAction, hashPassword, requireOwnerApi, verifyPassword } from "@/lib/saas-owner";
import { saasOwnerRoles, saasOwners, saasOwnerSessions } from "@pixa/db";

/**
 * PATCH an owner: activate/deactivate, assign role, reset password.
 * Super-owner-only. Single-super-owner invariant: the last active
 * super_owner can never be demoted or deactivated (Odoo's impotent-admin
 * rule). Destructive changes require the acting owner's password.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi(["owners:manage"]);
  if ("response" in auth) return auth.response;
  if (!auth.owner.isSuper) {
    return NextResponse.json({ ok: false, error: "super owner only" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  try {
    const db = adminDb();
    const rows = await db.select().from(saasOwners).where(eq(saasOwners.id, id)).limit(1);
    if (rows.length === 0)
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    const target = rows[0];
    const deactivating = body?.isActive === false && target.isActive !== false;
    const resetting = typeof body?.password === "string" && body.password.length > 0;

    // Last-super-owner invariant (Odoo's impotent-admin rule): the singleton
    // super owner can never be deactivated — there is no second one.
    if (deactivating && target.role === "super_owner") {
      return NextResponse.json(
        { ok: false, error: "cannot deactivate the singleton super owner" },
        { status: 409 },
      );
    }

    // Step-up for destructive acts (no TOTP in v1).
    if (deactivating || resetting) {
      const confirm = String(body?.confirmPassword ?? "");
      if (!confirm) {
        return NextResponse.json(
          { ok: false, error: "password confirmation required" },
          { status: 403 },
        );
      }
      const self = await db
        .select()
        .from(saasOwners)
        .where(eq(saasOwners.id, auth.owner.id))
        .limit(1);
      if (self.length === 0 || !verifyPassword(confirm, self[0].passwordHash)) {
        return NextResponse.json(
          { ok: false, error: "password confirmation failed" },
          { status: 403 },
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (body?.isActive !== undefined) patch.isActive = Boolean(body.isActive);
    if (body?.role !== undefined && String(body.role) !== "staff") {
      // Singleton guarantee: the super_owner role is seed-only. Staff stay
      // staff; ownership transfer is an explicit future flow, not an edit.
      return NextResponse.json({ ok: false, error: "role is immutable" }, { status: 400 });
    }
    if (body?.roleId !== undefined) {
      if (target.role === "super_owner") {
        return NextResponse.json({ ok: false, error: "role is immutable" }, { status: 400 });
      }
      patch.roleId = body.roleId === null ? null : String(body.roleId);
      if (patch.roleId) {
        const r = await db
          .select({ id: saasOwnerRoles.id })
          .from(saasOwnerRoles)
          .where(eq(saasOwnerRoles.id, patch.roleId as string))
          .limit(1);
        if (r.length === 0)
          return NextResponse.json({ ok: false, error: "unknown role" }, { status: 400 });
      }
    }
    if (resetting) {
      if (body.password.length < 12) {
        return NextResponse.json(
          { ok: false, error: "12+ char password required" },
          { status: 400 },
        );
      }
      patch.passwordHash = hashPassword(body.password);
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });
    }
    await db.update(saasOwners).set(patch).where(eq(saasOwners.id, id));
    if (resetting || body?.isActive === false) {
      // Changed credentials / deactivation kills all their sessions at once.
      await db.delete(saasOwnerSessions).where(eq(saasOwnerSessions.ownerId, id));
    }
    await auditOwnerAction(
      auth.owner,
      "owner",
      id,
      "OWNER_UPDATED",
      JSON.stringify(patch)
        .slice(0, 300)
        .replace(/"passwordHash":"[^"]*"/, '"passwordHash":"[redacted]"'),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
