import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, hashPassword, requireOwnerApi } from "@/lib/saas-owner";
import { saasOwnerRoles, saasOwners } from "@pixa/db";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeOwner(o: typeof saasOwners.$inferSelect) {
  const { passwordHash: _drop, ...rest } = o;
  return rest;
}

/** List owners (hashes never leave the server) + roles for the UI. */
export async function GET() {
  const auth = await requireOwnerApi(["owners:manage"]);
  if ("response" in auth) return auth.response;
  try {
    const db = adminDb();
    const owners = await db.select().from(saasOwners).orderBy(saasOwners.createdAt);
    const roles = await db.select().from(saasOwnerRoles).orderBy(saasOwnerRoles.name);
    return NextResponse.json({ ok: true, owners: owners.map(safeOwner), roles });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

/** Invite a staff owner (super owners only — checked via isSuper). */
export async function POST(req: Request) {
  const auth = await requireOwnerApi(["owners:manage"]);
  if ("response" in auth) return auth.response;
  if (!auth.owner.isSuper) {
    return NextResponse.json({ ok: false, error: "super owner only" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  const roleId = body?.roleId === null || body?.roleId === undefined ? null : String(body.roleId);
  if (!EMAIL.test(email) || password.length < 12) {
    return NextResponse.json(
      { ok: false, error: "valid email and 12+ char password required" },
      { status: 400 },
    );
  }
  try {
    const db = adminDb();
    if (roleId) {
      const r = await db
        .select({ id: saasOwnerRoles.id })
        .from(saasOwnerRoles)
        .where(eq(saasOwnerRoles.id, roleId))
        .limit(1);
      if (r.length === 0)
        return NextResponse.json({ ok: false, error: "unknown role" }, { status: 400 });
    }
    const dup = await db
      .select({ id: saasOwners.id })
      .from(saasOwners)
      .where(eq(saasOwners.email, email))
      .limit(1);
    if (dup.length > 0)
      return NextResponse.json({ ok: false, error: "email taken" }, { status: 409 });
    const id = uid("sowner");
    await db.insert(saasOwners).values({
      id,
      email,
      passwordHash: hashPassword(password),
      role: "staff",
      roleId,
      isActive: true,
    });
    await auditOwnerAction(auth.owner, "owner", id, "OWNER_INVITED", email);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
