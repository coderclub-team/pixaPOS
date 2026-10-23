import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import { getPurchaseById } from "@/features/inventory/api/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authz(POS_PERMISSIONS.inventoryView);
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  try {
    const purchase = await getPurchaseById(a.auth.organizationId, id);
    if (!purchase) {
      return NextResponse.json({ error: "purchase not found" }, { status: 404 });
    }
    return NextResponse.json({ purchase });
  } catch (e) {
    return toHttpError(e, "failed to get purchase");
  }
}
