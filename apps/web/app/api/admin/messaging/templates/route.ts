import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { msgTemplates, MSG_CHANNELS } from "@pixa/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerApi(["messaging:read"]);
  if ("response" in auth) return auth.response;
  try {
    const rows = await adminDb().select().from(msgTemplates).orderBy(asc(msgTemplates.name));
    return NextResponse.json({
      ok: true,
      templates: rows.map((t) => ({ ...t, variables: JSON.parse(t.variables ?? "[]") })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi(["messaging:send"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const channel = String(body?.channel ?? "");
  const name = String(body?.name ?? "").trim();
  const tmplBody = String(body?.body ?? "").trim();
  if (!(MSG_CHANNELS as readonly string[]).includes(channel)) {
    return NextResponse.json({ ok: false, error: "invalid channel" }, { status: 400 });
  }
  if (!name || !tmplBody) {
    return NextResponse.json({ ok: false, error: "name and body required" }, { status: 400 });
  }
  const variables = Array.isArray(body?.variables)
    ? body.variables
        .map((v: unknown) => String(v))
        .filter(Boolean)
        .slice(0, 20)
    : [...new Set([...tmplBody.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))].slice(0, 20);
  try {
    const id = uid("tpl");
    await adminDb()
      .insert(msgTemplates)
      .values({
        id,
        channel,
        name: name.slice(0, 120),
        subject: String(body?.subject ?? "").slice(0, 200) || null,
        body: tmplBody.slice(0, 8000),
        variables: JSON.stringify(variables),
      });
    await auditOwnerAction(auth.owner, "template", id, "TEMPLATE_CREATED", name);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireOwnerApi(["messaging:send"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.name !== undefined) patch.name = String(body.name).trim().slice(0, 120) || undefined;
  if (body?.subject !== undefined) patch.subject = String(body.subject).slice(0, 200) || null;
  if (body?.body !== undefined) {
    const b = String(body.body).trim();
    if (!b) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });
    patch.body = b.slice(0, 8000);
    patch.variables = JSON.stringify(
      [...new Set([...b.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))].slice(0, 20),
    );
  }
  if (body?.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  try {
    await adminDb().update(msgTemplates).set(patch).where(eq(msgTemplates.id, id));
    await auditOwnerAction(auth.owner, "template", id, "TEMPLATE_UPDATED");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
