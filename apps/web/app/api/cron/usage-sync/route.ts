import { NextResponse } from "next/server";
import { adminDb } from "@/lib/saas-admin";
import { baOrganization } from "@pixa/db";
import { getUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled usage sync (Vercel Cron). Independent of any POS request path.
 *
 * Refreshes each organization's usage row: rolls monthly counters when the
 * billing period changes and recomputes organization-scoped product counts
 * (users). Infrastructure metrics (database/object storage, compute, functions,
 * transfer, written data) are written separately by the Neon consumption
 * integration once configured — this route never fabricates them.
 *
 * Protected by CRON_SECRET (Vercel sends `Authorization: Bearer <secret>`).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const orgs = await adminDb().select({ id: baOrganization.id }).from(baOrganization);
    let synced = 0;
    const failures: string[] = [];
    for (const org of orgs) {
      try {
        await getUsage(org.id);
        synced++;
      } catch {
        failures.push(org.id);
      }
    }
    return NextResponse.json({
      ok: true,
      synced,
      failed: failures.length,
      at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "sync failed" }, { status: 503 });
  }
}
