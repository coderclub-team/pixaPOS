import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { clearSplit, computeSplits } from "@/features/orders/api/server";

export const dynamic = "force-dynamic";

/** POST /api/orders/:id/split — build or rebuild partitions. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: { mode?: string; count?: number; assignments?: unknown[]; amounts?: unknown[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const order = await computeSplits(
      a.auth.organizationId,
      id,
      body as Parameters<typeof computeSplits>[2],
    );
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e, "failed to split bill");
  }
}

/** DELETE /api/orders/:id/split?reason= — remove the active split. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  const url = new URL(req.url);
  try {
    const order = await clearSplit(a.auth.organizationId, id, {
      reason: url.searchParams.get("reason") ?? "",
      by: a.auth.userId ?? "staff",
    });
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e, "failed to clear split");
  }
}
