import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { authz, toHttpError } from "@/lib/api-auth";
import {
  acceptKOT,
  acceptKOTLine,
  getTicketById,
  increaseKOTLineQty,
  markLineReady,
  returnKOTLine,
  serveKOT,
  startPreparingKOT,
  startPreparingKOTLine,
  voidKOT,
  voidKOTLine,
} from "@/features/kitchen/api/server";

export const dynamic = "force-dynamic";

/** GET /api/kots/:id — single ticket with lines. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersView);
  if ("error" in a) return a.error;
  try {
    const ticket = await getTicketById(a.auth.organizationId, id);
    if (!ticket) return NextResponse.json({ error: "KOT not found" }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (e) {
    return toHttpError(e, "failed to load KOT");
  }
}

/**
 * PATCH /api/kots/:id { action, line_id?, qty?, extra?, reason?, by?, ... }.
 * Ticket moves: accept | prepare | ready-walk | serve.
 * Line moves: accept-line | start-line | line-ready | serve-line(via ready-all) |
 * increase-qty | void (whole) | void-line | return-line.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.ordersManage);
  if ("error" in a) return a.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const by = (body.by as string | undefined) ?? a.auth.userId ?? "kitchen";
  const org = a.auth.organizationId;
  try {
    const action = String(body.action ?? "");
    const lineId = body.line_id != null ? String(body.line_id) : undefined;
    switch (action) {
      case "accept":
        return NextResponse.json({
          ok: true,
          ticket: await acceptKOT(org, id, { by }),
        });
      case "prepare":
        return NextResponse.json({
          ok: true,
          ticket: await startPreparingKOT(org, id, { by }),
        });
      case "serve":
        return NextResponse.json({
          ok: true,
          ticket: await serveKOT(org, id, { by }),
        });
      case "accept-line":
        if (!lineId) return NextResponse.json({ error: "line_id required" }, { status: 400 });
        return NextResponse.json({
          ok: true,
          ticket: await acceptKOTLine(org, id, lineId, { by }),
        });
      case "start-line":
        if (!lineId) return NextResponse.json({ error: "line_id required" }, { status: 400 });
        return NextResponse.json({
          ok: true,
          ticket: await startPreparingKOTLine(org, id, lineId, { by }),
        });
      case "line-ready":
        if (!lineId) return NextResponse.json({ error: "line_id required" }, { status: 400 });
        return NextResponse.json({
          ok: true,
          ticket: await markLineReady(org, id, lineId, { by }),
        });
      case "increase-qty":
        if (!lineId) return NextResponse.json({ error: "line_id required" }, { status: 400 });
        return NextResponse.json({
          ok: true,
          ticket: await increaseKOTLineQty(org, id, lineId, Number(body.extra ?? 1), { by }),
        });
      case "void":
        return NextResponse.json({
          ok: true,
          ticket: await voidKOT(org, id, {
            reason: String(body.reason ?? ""),
            by,
          }),
        });
      case "void-line":
        if (!lineId) return NextResponse.json({ error: "line_id required" }, { status: 400 });
        return NextResponse.json({
          ok: true,
          ticket: await voidKOTLine(org, id, lineId, {
            qty: body.qty !== undefined ? Number(body.qty) : undefined,
            reason: String(body.reason ?? ""),
            by,
          }),
        });
      case "return-line":
        if (!lineId) return NextResponse.json({ error: "line_id required" }, { status: 400 });
        return NextResponse.json({
          ok: true,
          ticket: await returnKOTLine(org, id, lineId, {
            qty: Number(body.qty ?? 0),
            amount_paise: Number(body.amount_paise ?? 0),
            reason: String(body.reason ?? ""),
            by,
          }),
        });
      default:
        return NextResponse.json({ error: "unknown KOT action" }, { status: 400 });
    }
  } catch (e) {
    return toHttpError(e, "KOT action failed");
  }
}
