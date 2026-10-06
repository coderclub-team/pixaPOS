import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { dispatchSend } from "@/lib/messaging-providers";
import { msgOutbox, msgProviders, msgTemplates } from "@pixa/db";

export const dynamic = "force-dynamic";

/** Queue + immediately attempt one send (promo blast / transactional). */
export async function POST(req: Request) {
  const auth = await requireOwnerApi(["messaging:send"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const to = Array.isArray(body?.to)
    ? body.to
        .map((t: unknown) => String(t).trim())
        .filter(Boolean)
        .slice(0, 50)
    : [String(body?.to ?? "").trim()].filter(Boolean);
  const channel = String(body?.channel ?? "");
  const providerId = String(body?.providerId ?? "");
  if (to.length === 0)
    return NextResponse.json({ ok: false, error: "to required" }, { status: 400 });
  if (!["email", "whatsapp", "sms"].includes(channel)) {
    return NextResponse.json({ ok: false, error: "invalid channel" }, { status: 400 });
  }
  let subject = String(body?.subject ?? "");
  let text = String(body?.body ?? "");
  let templateId: string | null = null;
  const vars =
    typeof body?.vars === "object" && body.vars !== null
      ? (body.vars as Record<string, string>)
      : {};
  try {
    const db = adminDb();
    if (body?.templateId) {
      const t = await db
        .select()
        .from(msgTemplates)
        .where(eq(msgTemplates.id, String(body.templateId)))
        .limit(1);
      if (t.length === 0)
        return NextResponse.json({ ok: false, error: "unknown template" }, { status: 400 });
      subject = t[0].subject ?? "";
      text = t[0].body;
      templateId = t[0].id;
    }
    if (!text.trim())
      return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });
    const prv = providerId
      ? (await db.select().from(msgProviders).where(eq(msgProviders.id, providerId)).limit(1))[0]
      : (
          await db.select().from(msgProviders).where(eq(msgProviders.channel, channel)).limit(10)
        ).find((p) => p.isActive);
    if (!prv) return NextResponse.json({ ok: false, error: "no active provider" }, { status: 400 });
    const cfg = JSON.parse(prv.config ?? "{}") as Record<string, string>;
    const results: { to: string; ok: boolean; id?: string; error?: string }[] = [];
    for (const dest of to) {
      const id = uid("msg");
      await db.insert(msgOutbox).values({
        id,
        channel,
        to: dest,
        templateId,
        providerId: prv.id,
        subject: subject.slice(0, 200) || null,
        body: text.slice(0, 8000),
        status: "sending",
        createdBy: auth.owner.email,
      });
      const r = await dispatchSend(
        channel as "email" | "whatsapp" | "sms",
        prv.provider,
        cfg,
        dest,
        subject,
        text,
        vars,
      );
      await db
        .update(msgOutbox)
        .set({
          status: r.ok ? "sent" : "failed",
          providerMessageId: r.providerMessageId ?? null,
          error: r.error ?? null,
          sentAt: r.ok ? new Date() : null,
        })
        .where(eq(msgOutbox.id, id));
      results.push({ to: dest, ok: r.ok, id, error: r.error });
    }
    const sent = results.filter((r) => r.ok).length;
    await auditOwnerAction(
      auth.owner,
      "message",
      templateId ?? "adhoc",
      "MESSAGE_SENT",
      `${channel} ${sent}/${results.length} via ${prv.provider}`,
    );
    return NextResponse.json({ ok: sent > 0, sent, total: results.length, results });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function GET(req: Request) {
  const auth = await requireOwnerApi(["messaging:read"]);
  if ("response" in auth) return auth.response;
  const limit = Math.min(
    200,
    Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 50) || 50),
  );
  try {
    const rows = await adminDb()
      .select({
        id: msgOutbox.id,
        channel: msgOutbox.channel,
        to: msgOutbox.to,
        status: msgOutbox.status,
        error: msgOutbox.error,
        createdBy: msgOutbox.createdBy,
        createdAt: msgOutbox.createdAt,
        sentAt: msgOutbox.sentAt,
      })
      .from(msgOutbox)
      .orderBy(desc(msgOutbox.createdAt))
      .limit(limit);
    return NextResponse.json({ ok: true, messages: rows });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
