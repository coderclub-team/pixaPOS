import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { db, baMember, baUser } from "@pixa/db";

export const dynamic = "force-dynamic";

function splitName(name: string | null | undefined): { first_name: string; last_name: string } {
  const parts = (name ?? "").trim().split(/\s+/);
  return {
    first_name: parts[0] || "User",
    last_name: parts.slice(1).join(" ") || "",
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz(POS_PERMISSIONS.usersManage);
  if ("error" in a) return a.error;
  const { id } = await ctx.params;

  try {
    const member = await db()
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
      .where(and(eq(baMember.organizationId, a.auth.organizationId), eq(baMember.userId, id)))
      .limit(1);

    const m = member[0];
    if (!m) return NextResponse.json({ error: "user not found" }, { status: 404 });

    const { first_name, last_name } = splitName(m.name);
    return NextResponse.json({
      id: m.userId,
      first_name,
      last_name,
      email: m.email || "",
      phone: "",
      status: "active",
      role: m.role || "waiter",
      created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      updated_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    });
  } catch (e) {
    return toHttpError(e, "failed to get user");
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz(POS_PERMISSIONS.usersManage);
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    if (body.role) {
      await db()
        .update(baMember)
        .set({ role: String(body.role) })
        .where(and(eq(baMember.organizationId, a.auth.organizationId), eq(baMember.userId, id)));
    }

    if (body.first_name || body.last_name) {
      const fullName = `${body.first_name ?? ""} ${body.last_name ?? ""}`.trim();
      await db()
        .update(baUser)
        .set({ name: fullName, updatedAt: new Date() })
        .where(eq(baUser.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return toHttpError(e, "failed to update user");
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz(POS_PERMISSIONS.usersManage);
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  try {
    await db()
      .delete(baMember)
      .where(and(eq(baMember.organizationId, a.auth.organizationId), eq(baMember.userId, id)));
    return NextResponse.json({ success: true });
  } catch (e) {
    return toHttpError(e, "failed to delete user");
  }
}
