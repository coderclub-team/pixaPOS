import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { testProvider } from "@/lib/messaging-providers";
import { msgProviders } from "@pixa/db";

export const dynamic = "force-dynamic";

/** Connectivity probe for a stored provider (no message sent). */
export async function POST(req: Request) {
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
    const p = rows[0];
    const result = await testProvider(
      p.channel,
      p.provider,
      JSON.parse(p.config ?? "{}") as Record<string, string>,
    );
    await db
      .update(msgProviders)
      .set({ lastTestedAt: new Date(), lastTestOk: result.ok, updatedAt: new Date() })
      .where(eq(msgProviders.id, id));
    await auditOwnerAction(
      auth.owner,
      "provider",
      id,
      result.ok ? "PROVIDER_TEST_OK" : "PROVIDER_TEST_FAIL",
      result.error ?? null,
    );
    return NextResponse.json({ ok: result.ok, error: result.error });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
