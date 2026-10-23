import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  floorObjects,
  floors,
  occupancyGroups,
  reservationHolds,
  tableBlocks,
  tables,
} from "@pixa/db";
import { authz, toHttpError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/floors/:id/layout — floor + tables (with derived occupancy) + groups + blocks + holds + objects. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await authz();
  if ("error" in a) return a.error;
  try {
    const floorRows = await db()
      .select()
      .from(floors)
      .where(and(eq(floors.id, id), eq(floors.organizationId, a.auth.organizationId)))
      .limit(1);
    const floor = floorRows[0];
    if (!floor || (floor as { deletedAt?: unknown }).deletedAt)
      return NextResponse.json({ error: "not found" }, { status: 404 });

    const tableRows = await db()
      .select()
      .from(tables)
      .where(
        and(
          eq(tables.organizationId, a.auth.organizationId),
          eq(tables.floorId, id),
          isNull(tables.deletedAt),
        ),
      );
    const tableIds = tableRows.map((t) => t.id);
    const [groupRows, blockRows, holdRows, objectRows] = tableIds.length
      ? await Promise.all([
          db()
            .select()
            .from(occupancyGroups)
            .where(
              and(
                eq(occupancyGroups.organizationId, a.auth.organizationId),
                inArray(occupancyGroups.tableId, tableIds),
                inArray(occupancyGroups.status, ["SEATED", "ORDERING"]),
              ),
            ),
          db()
            .select()
            .from(tableBlocks)
            .where(
              and(
                eq(tableBlocks.organizationId, a.auth.organizationId),
                inArray(tableBlocks.tableId, tableIds),
                isNull(tableBlocks.releasedAt),
              ),
            ),
          db()
            .select()
            .from(reservationHolds)
            .where(
              and(
                eq(reservationHolds.organizationId, a.auth.organizationId),
                inArray(reservationHolds.tableId, tableIds),
                eq(reservationHolds.status, "HELD"),
              ),
            ),
          db()
            .select()
            .from(floorObjects)
            .where(
              and(
                eq(floorObjects.organizationId, a.auth.organizationId),
                eq(floorObjects.floorId, id),
                isNull(floorObjects.deletedAt),
              ),
            ),
        ])
      : [[], [], [], []];
    return NextResponse.json(
      {
        floor,
        tables: tableRows,
        groups: groupRows,
        blocks: blockRows,
        holds: holdRows,
        objects: objectRows,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return toHttpError(e, "failed to load floor layout");
  }
}
