import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { baMember, baOrganization, orgProfiles } from "@pixa/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = adminDb();
    const orgs = await db
      .select()
      .from(baOrganization)
      .orderBy(desc(baOrganization.createdAt))
      .limit(200);
    const profiles = await db.select().from(orgProfiles);
    const pmap = new Map(profiles.map((p) => [p.organizationId, p]));
    const members = await db.select().from(baMember);
    const counts = new Map<string, number>();
    for (const m of members) counts.set(m.organizationId, (counts.get(m.organizationId) ?? 0) + 1);
    return NextResponse.json({
      ok: true,
      organizations: orgs.map((o) => ({
        ...o,
        profile: pmap.get(o.id) ?? null,
        seats: counts.get(o.id) ?? 0,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
