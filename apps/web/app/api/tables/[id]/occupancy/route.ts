import { NextResponse } from "next/server";
import { POS_PERMISSIONS } from "@pixa/server";
import { assertOrgOutlet, authz, toHttpError } from "@/lib/api-auth";
import {
  addGuests,
  attachOrder,
  cancelOccupancy,
  detachOrder,
  forceReleaseOccupancy,
  releaseOccupancy,
  seatOccupancy,
  transferOccupancy,
} from "@/features/table/api/server";

export const dynamic = "force-dynamic";

type Action =
  | {
      action: "seat";
      seats: number;
      hold_id?: string;
      force?: boolean;
      reason?: string;
      group_id?: string;
      created_by?: string;
      outlet_id?: string;
    }
  | { action: "add-guests"; group_id: string; extra_seats: number; ctx?: { actorId?: string } }
  | { action: "attach-order"; group_id: string; order_id: string }
  | { action: "detach-order"; group_id: string; order_id: string }
  | { action: "release"; group_id: string; reason: string; released_by?: string; force?: boolean }
  | { action: "cancel"; group_id: string; by?: string; reason: string }
  | {
      action: "transfer";
      group_ids: string[];
      to_outlet_id?: string;
      to_table_id: string;
      moved_by?: string;
      reason: string;
    };

/**
 * POST /api/tables/:id/occupancy — occupancy commands (org:tables:operate).
 * Seat / add guests / attach or detach an order / release / cancel /
 * transfer between tables. The table id in the path scopes locking + audit;
 * group ids always win for the target table.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz(POS_PERMISSIONS.tablesOperate);
  if ("error" in a) return a.error;
  let body: Action;
  try {
    body = (await req.json()) as Action;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const outletId = await assertOrgOutlet(
      a.auth.organizationId,
      (body as { outlet_id?: string }).outlet_id ?? null,
    );
    const base = { organizationId: a.auth.organizationId, outletId, actorId: a.auth.userId };
    switch (body.action) {
      case "seat": {
        const group = await seatOccupancy({
          table_id: id,
          seats: body.seats,
          created_by: body.created_by,
          hold_id: body.hold_id,
          force: body.force,
          reason: body.reason,
          group_id: body.group_id,
          ctx: base,
        });
        return NextResponse.json({ ok: true, group }, { status: 201 });
      }
      case "add-guests": {
        const group = await addGuests({
          group_id: body.group_id,
          extra_seats: body.extra_seats,
          ctx: { ...base, actorId: body.ctx?.actorId ?? base.actorId },
        });
        return NextResponse.json({ ok: true, group });
      }
      case "attach-order": {
        const group = await attachOrder({
          group_id: body.group_id,
          order_id: body.order_id,
          ctx: base,
        });
        return NextResponse.json({ ok: true, group });
      }
      case "detach-order": {
        await detachOrder({ group_id: body.group_id, order_id: body.order_id, ctx: base });
        return NextResponse.json({ ok: true });
      }
      case "release": {
        if (body.force) {
          await forceReleaseOccupancy({
            group_id: body.group_id,
            released_by: body.released_by,
            reason: body.reason,
            ctx: base,
          });
        } else {
          await releaseOccupancy({
            group_id: body.group_id,
            released_by: body.released_by,
            reason: body.reason,
            ctx: base,
          });
        }
        return NextResponse.json({ ok: true });
      }
      case "cancel": {
        await cancelOccupancy({
          group_id: body.group_id,
          by: body.by,
          reason: body.reason,
          ctx: base,
        });
        return NextResponse.json({ ok: true });
      }
      case "transfer": {
        const moved = await transferOccupancy({
          group_ids: body.group_ids,
          to_table_id: body.to_table_id,
          moved_by: body.moved_by,
          reason: body.reason,
          ctx: base,
        });
        return NextResponse.json({ ok: true, moved });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return toHttpError(e, "occupancy command failed");
  }
}
