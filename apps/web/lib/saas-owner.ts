import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { saasOwnerRoles, saasOwners, saasOwnerSessions } from "@pixa/db";

/**
 * SaaS-owner identity plane. Separate from Better Auth/restaurant users:
 * different tables, different cookie (`pixa_owner`), no shared secrets.
 * A restaurant session cookie or credential can never resolve here.
 */

export const OWNER_COOKIE = "pixa_owner";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Scoped permissions for owner-created staff (super_owner has all). */
export const SAAS_PERMISSIONS = [
  "leads:read",
  "leads:write",
  "orgs:read",
  "orgs:lifecycle",
  "billing:read",
  "billing:mrr",
  "plans:manage",
  "audit:read",
  "owners:manage",
] as const;
export type SaasPermission = (typeof SAAS_PERMISSIONS)[number];

export type OwnerContext = {
  id: string;
  email: string;
  isSuper: boolean;
  permissions: string[];
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** scrypt password hash: `scrypt$N$r$p$salt$hash` (Node built-in, no dep). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [, n, r, p, salt, hash] = stored.split("$");
    const check = scryptSync(password, salt, 64, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    }).toString("hex");
    const a = Buffer.from(check, "hex");
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parsePermissions(raw: string | null): string[] {
  try {
    const arr = JSON.parse(raw ?? "[]");
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Resolve the current owner session from the `pixa_owner` cookie. */
export async function getOwnerSession(): Promise<OwnerContext | null> {
  const token = (await cookies()).get(OWNER_COOKIE)?.value;
  if (!token) return null;
  try {
    const db = adminDb();
    const rows = await db
      .select()
      .from(saasOwnerSessions)
      .where(
        and(
          eq(saasOwnerSessions.tokenHash, hashToken(token)),
          gt(saasOwnerSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    const owners = await db
      .select()
      .from(saasOwners)
      .where(and(eq(saasOwners.id, rows[0].ownerId), eq(saasOwners.isActive, true)))
      .limit(1);
    if (owners.length === 0) return null;
    const owner = owners[0];
    if (owner.role === "super_owner") {
      return {
        id: owner.id,
        email: owner.email,
        isSuper: true,
        permissions: [...SAAS_PERMISSIONS],
      };
    }
    let permissions: string[] = [];
    if (owner.roleId) {
      const roles = await db
        .select()
        .from(saasOwnerRoles)
        .where(eq(saasOwnerRoles.id, owner.roleId))
        .limit(1);
      if (roles.length > 0) permissions = parsePermissions(roles[0].permissions);
    }
    return { id: owner.id, email: owner.email, isSuper: false, permissions };
  } catch {
    return null;
  }
}

export function ownerCookieHeader(token: string, maxAgeSec = SESSION_TTL_MS / 1000): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OWNER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function clearOwnerCookieHeader(): string {
  return `${OWNER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}

export async function createOwnerSession(
  ownerId: string,
  req: Request,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const db = adminDb();
  await db.insert(saasOwnerSessions).values({
    tokenHash: hashToken(token),
    ownerId,
    expiresAt,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  await db
    .update(saasOwners)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ lastLoginAt: new Date() } as never)
    .where(eq(saasOwners.id, ownerId));
  return { token, expiresAt };
}

export async function revokeOwnerSession(token: string): Promise<void> {
  try {
    await adminDb()
      .delete(saasOwnerSessions)
      .where(eq(saasOwnerSessions.tokenHash, hashToken(token)));
  } catch {
    /* logout is best-effort */
  }
}

type Authed = { owner: OwnerContext } | { response: NextResponse };

/**
 * Gate for /api/admin/* (except the public lead intake). Returns the owner
 * context, or `{ response }` (401/403 JSON) for the route to return.
 * Never redirects — APIs speak JSON.
 */
export async function requireOwnerApi(required: SaasPermission[] = []): Promise<Authed> {
  const owner = await getOwnerSession();
  if (!owner) {
    return {
      response: NextResponse.json({ ok: false, error: "owner sign-in required" }, { status: 401 }),
    };
  }
  const missing = required.filter((p) => !owner.permissions.includes(p));
  if (missing.length > 0) {
    return {
      response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
    };
  }
  return { owner };
}

/** Append an owner-attributed audit row. Never throws (audit must not break writes). */
export async function auditOwnerAction(
  owner: OwnerContext,
  entityType: string,
  entityId: string,
  action: string,
  detail?: string | null,
): Promise<void> {
  try {
    const { saasAudit } = await import("@pixa/db");
    const { uid } = await import("@/lib/saas-admin");
    await adminDb()
      .insert(saasAudit)
      .values({
        id: uid("audit"),
        actorEmail: `owner:${owner.email}`,
        entityType,
        entityId,
        action,
        detail: detail ?? null,
      });
  } catch {
    /* audit is best-effort */
  }
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Tiny in-memory rate limit for the public lead intake (single instance;
 * edge/proxy limiting still recommended in front of it). */
export function leadIntakeAllowed(ip: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
