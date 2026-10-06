import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import {
  auditOwnerAction,
  clearOwnerCookieHeader,
  createOwnerSession,
  hashPassword,
  ownerCookieHeader,
  requireOwnerApi,
  verifyPassword,
} from "@/lib/saas-owner";
import { saasOwners } from "@pixa/db";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Owner sign-in. Separate plane from restaurant auth: no Better Auth involved. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  if (!EMAIL.test(email) || !password) {
    return NextResponse.json({ ok: false, error: "email and password required" }, { status: 400 });
  }
  try {
    const db = adminDb();
    const rows = await db.select().from(saasOwners).where(eq(saasOwners.email, email)).limit(1);
    const owner = rows[0];
    // Same response for unknown email vs wrong password (no enumeration).
    if (!owner || !owner.isActive || !verifyPassword(password, owner.passwordHash)) {
      // Small constant-time cushion against brute force (rate-limit at proxy too).
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ ok: false, error: "invalid credentials" }, { status: 401 });
    }
    const { token } = await createOwnerSession(owner.id, req);
    await auditOwnerAction(
      { id: owner.id, email: owner.email, isSuper: owner.role === "super_owner", permissions: [] },
      "owner",
      owner.id,
      "OWNER_LOGIN",
    );
    const res = NextResponse.json({ ok: true });
    res.headers.append("Set-Cookie", ownerCookieHeader(token));
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

/** Owner sign-out (revokes the server session; replay dies here). */
export async function DELETE() {
  const { cookies } = await import("next/headers");
  const { OWNER_COOKIE, revokeOwnerSession } = await import("@/lib/saas-owner");
  const token = (await cookies()).get(OWNER_COOKIE)?.value;
  if (token) await revokeOwnerSession(token);
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", clearOwnerCookieHeader());
  return res;
}

/**
 * One-time bootstrap: creates the first super owner. Works ONLY when zero
 * owners exist AND the caller presents SAAS_SETUP_TOKEN. After that it 403s
 * forever. There is no email-allowlist fallback by design.
 */
export async function PUT(req: Request) {
  const setupToken = process.env.SAAS_SETUP_TOKEN;
  if (!setupToken) {
    return NextResponse.json({ ok: false, error: "seeding disabled" }, { status: 403 });
  }
  if (req.headers.get("x-setup-token") !== setupToken) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  if (!EMAIL.test(email) || password.length < 12) {
    return NextResponse.json(
      { ok: false, error: "valid email and 12+ char password required" },
      { status: 400 },
    );
  }
  try {
    const db = adminDb();
    const existing = await db.select({ id: saasOwners.id }).from(saasOwners).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ ok: false, error: "already seeded" }, { status: 403 });
    }
    const { uid } = await import("@/lib/saas-admin");
    const id = uid("sowner");
    await db.insert(saasOwners).values({
      id,
      email,
      passwordHash: hashPassword(password),
      role: "super_owner",
      roleId: null,
      isActive: true,
    });
    await auditOwnerAction(
      { id, email, isSuper: true, permissions: [] },
      "owner",
      id,
      "OWNER_SEEDED",
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

/** Change own password (used by the owner UI; staff passwords reset by super owner). */
export async function PATCH(req: Request) {
  const auth = await requireOwnerApi();
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");
  if (next.length < 12) {
    return NextResponse.json({ ok: false, error: "12+ char password required" }, { status: 400 });
  }
  try {
    const db = adminDb();
    const rows = await db
      .select()
      .from(saasOwners)
      .where(eq(saasOwners.id, auth.owner.id))
      .limit(1);
    if (rows.length === 0 || !verifyPassword(current, rows[0].passwordHash)) {
      return NextResponse.json({ ok: false, error: "current password incorrect" }, { status: 403 });
    }
    await db
      .update(saasOwners)
      .set({ passwordHash: hashPassword(next) })
      .where(eq(saasOwners.id, auth.owner.id));
    // Log everyone out (incl. this session): password change revokes all tokens.
    const { saasOwnerSessions } = await import("@pixa/db");
    await db.delete(saasOwnerSessions).where(eq(saasOwnerSessions.ownerId, auth.owner.id));
    await auditOwnerAction(auth.owner, "owner", auth.owner.id, "OWNER_PASSWORD_CHANGED");
    const res = NextResponse.json({ ok: true });
    res.headers.append("Set-Cookie", clearOwnerCookieHeader());
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
