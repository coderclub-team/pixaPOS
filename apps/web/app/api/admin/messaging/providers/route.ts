import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { maskConfig } from "@/lib/messaging-providers";
import { msgProviders } from "@pixa/db";

export const dynamic = "force-dynamic";

/** Provider kinds the console supports (channel → provider ids). */
export const PROVIDER_KINDS: Record<string, { id: string; label: string; fields: string[] }[]> = {
  whatsapp: [
    { id: "meta-cloud", label: "Meta Cloud API", fields: ["phoneNumberId", "accessToken"] },
    {
      id: "bsp",
      label: "BSP (Interakt / Gupshup / WATI / AiSensy)",
      fields: ["phoneNumberId", "accessToken", "apiUrl"],
    },
  ],
  sms: [
    { id: "msg91", label: "MSG91", fields: ["authKey", "senderId", "flowId", "route"] },
    { id: "textlocal", label: "TextLocal", fields: ["apiKey", "sender"] },
    { id: "twilio", label: "Twilio", fields: ["accountSid", "authToken", "from"] },
  ],
  email: [{ id: "smtp", label: "SMTP", fields: ["host", "port", "user", "password", "from"] }],
  "meta-ads": [
    { id: "meta-marketing", label: "Meta Marketing API", fields: ["accessToken", "adAccountId"] },
  ],
  "google-ads": [
    {
      id: "google-ads",
      label: "Google Ads API",
      fields: ["developerToken", "customerId", "clientId", "clientSecret", "refreshToken"],
    },
  ],
};

function parseConfig(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.length <= 2000) out[k] = v;
  }
  return out;
}

export async function GET() {
  const auth = await requireOwnerApi(["messaging:read"]);
  if ("response" in auth) return auth.response;
  try {
    const rows = await adminDb().select().from(msgProviders).orderBy(asc(msgProviders.channel));
    return NextResponse.json({
      ok: true,
      kinds: PROVIDER_KINDS,
      providers: rows.map((p) => ({
        ...p,
        config: maskConfig(JSON.parse(p.config ?? "{}") as Record<string, string>),
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi(["integrations:manage"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const channel = String(body?.channel ?? "");
  const provider = String(body?.provider ?? "");
  const kinds = PROVIDER_KINDS[channel] ?? [];
  if (!kinds.some((k) => k.id === provider)) {
    return NextResponse.json({ ok: false, error: "unknown channel/provider" }, { status: 400 });
  }
  try {
    const id = uid("prv");
    await adminDb()
      .insert(msgProviders)
      .values({
        id,
        channel,
        provider,
        displayName: String(body?.displayName ?? kinds.find((k) => k.id === provider)!.label).slice(
          0,
          120,
        ),
        config: JSON.stringify(parseConfig(body?.config)),
      });
    await auditOwnerAction(
      auth.owner,
      "provider",
      id,
      "PROVIDER_CREATED",
      `${channel}/${provider}`,
    );
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireOwnerApi(["integrations:manage"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  try {
    const db = adminDb();
    const rows = await db.select().from(msgProviders).where(eq(msgProviders.id, id)).limit(1);
    if (rows.length === 0)
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    // Merge configs: masked "••••••" values keep the stored secret.
    if (body?.config !== undefined) {
      const incoming = parseConfig(body.config);
      const stored = JSON.parse(rows[0].config ?? "{}") as Record<string, string>;
      for (const [k, v] of Object.entries(incoming)) {
        if (v === "••••••") delete incoming[k];
      }
      patch.config = JSON.stringify({ ...stored, ...incoming });
    }
    if (body?.displayName !== undefined) patch.displayName = String(body.displayName).slice(0, 120);
    if (body?.isActive !== undefined) patch.isActive = Boolean(body.isActive);
    await db.update(msgProviders).set(patch).where(eq(msgProviders.id, id));
    await auditOwnerAction(auth.owner, "provider", id, "PROVIDER_UPDATED");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireOwnerApi(["integrations:manage"]);
  if ("response" in auth) return auth.response;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  try {
    const db = adminDb();
    await db.delete(msgProviders).where(eq(msgProviders.id, id));
    await auditOwnerAction(auth.owner, "provider", id, "PROVIDER_DELETED");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
