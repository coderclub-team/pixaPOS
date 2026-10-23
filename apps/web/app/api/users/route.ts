import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { db, baMember, baUser } from "@pixa/db";
import { ulid } from "@pixa/contracts";

export const dynamic = "force-dynamic";

function splitName(name: string | null | undefined): { first_name: string; last_name: string } {
  const parts = (name ?? "").trim().split(/\s+/);
  return {
    first_name: parts[0] || "User",
    last_name: parts.slice(1).join(" ") || "",
  };
}

export async function GET(req: Request) {
  const a = await authz(POS_PERMISSIONS.usersManage);
  if ("error" in a) return a.error;
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.toLowerCase();
  const roleFilter = url.searchParams.get("roles");

  try {
    const members = await db()
      .select({
        memberId: baMember.id,
        userId: baMember.userId,
        role: baMember.role,
        createdAt: baMember.createdAt,
        name: baUser.name,
        email: baUser.email,
      })
      .from(baMember)
      .leftJoin(baUser, eq(baUser.id, baMember.userId))
      .where(eq(baMember.organizationId, a.auth.organizationId));

    let users = members.map((m, idx) => {
      const { first_name, last_name } = splitName(m.name);
      return {
        id: m.userId || m.memberId || idx + 1,
        first_name,
        last_name,
        email: m.email || "",
        phone: "",
        status: "active",
        role: m.role || "waiter",
        created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
        updated_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      };
    });

    if (search) {
      users = users.filter((u) =>
        `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search),
      );
    }

    if (roleFilter) {
      const roles = roleFilter.split(",");
      users = users.filter((u) => roles.includes(u.role));
    }

    return NextResponse.json({
      success: true,
      time: new Date().toISOString(),
      message: "Users retrieved successfully",
      total_users: users.length,
      offset: 0,
      limit: 500,
      users,
    });
  } catch (e) {
    return toHttpError(e, "failed to get users");
  }
}

export async function POST(req: Request) {
  const a = await authz(POS_PERMISSIONS.usersManage);
  if ("error" in a) return a.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const role = String(body.role ?? "waiter");
  const fullName = `${firstName} ${lastName}`.trim() || "User";

  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  try {
    const existing = await db()
      .select({ id: baUser.id })
      .from(baUser)
      .where(eq(baUser.email, email))
      .limit(1);

    let userId = existing[0]?.id;
    if (!userId) {
      userId = ulid();
      await db().insert(baUser).values({
        id: userId,
        name: fullName,
        email,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const memberCheck = await db()
      .select({ id: baMember.id })
      .from(baMember)
      .where(and(eq(baMember.organizationId, a.auth.organizationId), eq(baMember.userId, userId)))
      .limit(1);

    if (memberCheck.length > 0) {
      return NextResponse.json(
        { error: "user is already a member of this organization" },
        { status: 400 },
      );
    }

    const memberId = ulid();
    await db().insert(baMember).values({
      id: memberId,
      organizationId: a.auth.organizationId,
      userId,
      role,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: String(body.phone ?? ""),
          role,
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return toHttpError(e, "failed to create user");
  }
}
