import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, outlets } from "@pixa/db";
import { baHas, baOrgId, baSession } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

type OutletRow = Record<string, unknown>;

/** Server row → full outlet profile shape (settings JSONB holds the rest). */
export function rowToProfile(row: OutletRow): Record<string, unknown> {
  const settings = (row.settings ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    code: row.code,
    alias: row.alias ?? "",
    type: row.type ?? "restaurant",
    phone: row.phone ?? "",
    alternate_phone: row.alternate_phone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    whatsapp: row.whatsapp ?? "",
    address_line_1: row.address_line_1 ?? "",
    address_line_2: row.address_line_2 ?? "",
    locality: row.locality ?? "",
    city: row.city ?? "",
    district: row.district ?? "",
    state: row.state ?? "",
    country: row.country ?? "India",
    postal_code: row.postal_code ?? "",
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
    gst_registered: row.gst_registered ?? false,
    gstin: row.gstin ?? "",
    legal_name: row.legal_name ?? "",
    pan: row.pan ?? "",
    fssai_number: row.fssai_number ?? "",
    currency: row.currency ?? "INR",
    timezone: row.timezone ?? "Asia/Kolkata",
    locale: row.locale ?? "en-IN",
    ask_customer_details: settings.ask_customer_details ?? false,
    allow_off_hours_orders: settings.allow_off_hours_orders ?? false,
    require_off_hours_reason: settings.require_off_hours_reason ?? true,
    business_hours: settings.business_hours,
    upi_ids: settings.upi_ids ?? [],
    kiosk_pin_hash: row.kiosk_pin_hash ?? undefined,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const COLUMN_KEYS = [
  "alias",
  "type",
  "phone",
  "alternate_phone",
  "email",
  "website",
  "whatsapp",
  "address_line_1",
  "address_line_2",
  "locality",
  "city",
  "district",
  "state",
  "country",
  "postal_code",
  "latitude",
  "longitude",
  "gst_registered",
  "gstin",
  "legal_name",
  "pan",
  "fssai_number",
  "currency",
  "timezone",
  "locale",
] as const;

const SETTINGS_KEYS = [
  "ask_customer_details",
  "allow_off_hours_orders",
  "require_off_hours_reason",
  "business_hours",
  "upi_ids",
] as const;

async function authz(): Promise<{ organizationId: string } | NextResponse> {
  let session = null;
  try {
    session = await baSession();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const organizationId = await baOrgId().catch(() => null);
  if (!organizationId)
    return NextResponse.json({ error: "no active organization" }, { status: 400 });
  return { organizationId };
}

/** GET — full profile for one outlet of the caller's org. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz();
  if (a instanceof NextResponse) return a;
  const { id } = await ctx.params;
  try {
    const rows = await db()
      .select()
      .from(outlets)
      .where(and(eq(outlets.organizationId, a.organizationId), eq(outlets.id, id)))
      .limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "outlet not found" }, { status: 404 });
    return NextResponse.json(
      { outlet: rowToProfile(rows[0] as unknown as OutletRow) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to load outlet" }, { status: 500 });
  }
}

/** PUT — update profile (org:outlet:manage). Merges settings JSONB. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz();
  if (a instanceof NextResponse) return a;
  if (!(await baHas("org:outlet:manage").catch(() => false))) {
    return NextResponse.json({ error: "forbidden: outlet manage required" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (body.name !== undefined && String(body.name).trim().length < 2) {
    return NextResponse.json({ error: "name must be at least 2 characters" }, { status: 400 });
  }
  try {
    const database = db();
    const existing = await database
      .select()
      .from(outlets)
      .where(and(eq(outlets.organizationId, a.organizationId), eq(outlets.id, id)))
      .limit(1);
    if (existing.length === 0)
      return NextResponse.json({ error: "outlet not found" }, { status: 404 });
    const current = existing[0];
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const str = (v: unknown) => (v === undefined ? undefined : String(v));
    const setCol = (key: (typeof COLUMN_KEYS)[number], col: string, v: unknown) => {
      if (v !== undefined) (patch as Record<string, unknown>)[col] = v;
    };
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.alias !== undefined) patch.alias = str(body.alias);
    if (body.type !== undefined) patch.type = str(body.type);
    for (const k of ["phone", "alternate_phone", "email", "website", "whatsapp"] as const) {
      setCol(k, k, body[k] === undefined ? undefined : str(body[k]));
    }
    for (const k of [
      "address_line_1",
      "address_line_2",
      "locality",
      "city",
      "district",
      "state",
      "country",
      "postal_code",
    ] as const) {
      setCol(k, k, body[k] === undefined ? undefined : str(body[k]));
    }
    if (body.latitude !== undefined)
      patch.latitude =
        body.latitude === null || body.latitude === "" ? null : String(body.latitude);
    if (body.longitude !== undefined)
      patch.longitude =
        body.longitude === null || body.longitude === "" ? null : String(body.longitude);
    if (body.gst_registered !== undefined) patch.gstRegistered = Boolean(body.gst_registered);
    if (body.kiosk_pin_hash !== undefined) {
      patch.kioskPinHash =
        body.kiosk_pin_hash === null || body.kiosk_pin_hash === ""
          ? null
          : String(body.kiosk_pin_hash);
    }
    for (const k of [
      "gstin",
      "legal_name",
      "pan",
      "fssai_number",
      "currency",
      "timezone",
      "locale",
    ] as const) {
      setCol(k, k, body[k] === undefined ? undefined : str(body[k]));
    }
    const mergedSettings = { ...((current.settings ?? {}) as Record<string, unknown>) };
    for (const k of SETTINGS_KEYS) {
      if (body[k] !== undefined) mergedSettings[k] = body[k];
    }
    patch.settings = mergedSettings;
    await database
      .update(outlets)
      .set(patch as never)
      .where(and(eq(outlets.organizationId, a.organizationId), eq(outlets.id, id)));
    const refreshed = await database
      .select()
      .from(outlets)
      .where(and(eq(outlets.organizationId, a.organizationId), eq(outlets.id, id)))
      .limit(1);
    return NextResponse.json(
      { outlet: rowToProfile(refreshed[0] as unknown as OutletRow) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to update outlet" }, { status: 500 });
  }
}
