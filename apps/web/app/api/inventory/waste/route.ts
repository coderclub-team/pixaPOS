import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import { createWasteLog, listWasteLogs } from "@/features/inventory/api/server";
import type { WastePayload } from "@/features/inventory/api/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await authz(POS_PERMISSIONS.inventoryView);
  if ("error" in a) return a.error;
  const url = new URL(req.url);
  try {
    const rawOutlet = url.searchParams.get("outlet_id");
    const outletId = await assertOrgOutlet(a.auth.organizationId, rawOutlet, { required: true });
    if (!outletId) return NextResponse.json({ error: "outlet_id is required" }, { status: 400 });

    const logs = await listWasteLogs(a.auth.organizationId, outletId, {
      material_id: url.searchParams.get("material_id") ?? undefined,
      recipe_id: url.searchParams.get("recipe_id") ?? undefined,
      reason: (url.searchParams.get("reason") as any) ?? undefined,
    });
    return NextResponse.json({ logs });
  } catch (e) {
    return toHttpError(e, "failed to list waste logs");
  }
}

export async function POST(req: Request) {
  const a = await authz(POS_PERMISSIONS.wasteManage);
  if ("error" in a) return a.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const rawOutlet =
      (body.outlet_id as string | undefined) ?? new URL(req.url).searchParams.get("outlet_id");
    const outletId = await assertOrgOutlet(a.auth.organizationId, rawOutlet, { required: true });
    if (!outletId) return NextResponse.json({ error: "outlet_id is required" }, { status: 400 });

    const log = await createWasteLog(
      a.auth.organizationId,
      outletId,
      body as unknown as WastePayload,
      a.auth.userId,
    );
    return NextResponse.json({ log }, { status: 201 });
  } catch (e) {
    return toHttpError(e, "failed to record waste log");
  }
}
