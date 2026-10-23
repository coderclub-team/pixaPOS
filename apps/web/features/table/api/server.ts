/**
 * Tables domain — server implementation (Postgres via Drizzle).
 *
 * Faithful port of features/table/api/service.ts semantics (same guards,
 * same error strings, same events) with localStorage + SQLite + mutexes
 * replaced by direct DB reads/writes. Auth scoping (org + outlet) is
 * enforced per call: reads filter by organization (and outlet when the
 * caller scopes it), writes assert entity ownership first.
 *
 * Server-only: import from API routes, never from client components.
 * NOTE: no distributed locks (local entityMutex had none either across
 * processes). Concurrent same-table mutations may interleave; add
 * SELECT .. FOR UPDATE if terminal contention shows up.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, occupancyGroups, reservationHolds, tableBlocks, tables } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { recordServerEvent } from "@/features/events/api/server";
import { canTransition, deriveTableInfo, nextPartyLabel } from "./utils";
import type {
  OccupancyGroup,
  ReservationHold,
  TableBlock,
  TableFilters,
  TablePayload,
  TableStatus,
  TableWithDerived,
  RestaurantTable,
} from "./types";

export type ServerCtx = {
  organizationId: string;
  outletId?: string | null;
  actorId?: string;
};

const actorOf = (ctx: ServerCtx, fallback?: string) => ctx.actorId ?? fallback ?? "system";

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}
const isoOrNull = (v: unknown): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
};
const isoOrUndef = (v: unknown): string | undefined => {
  const s = isoOrNull(v);
  return s ?? undefined;
};

function toClientTable(r: Record<string, any>): RestaurantTable {
  return {
    id: String(r.id),
    outlet_id: String(r.outletId),
    floor_id: String(r.floorId),
    number: String(r.number),
    code: String(r.code),
    capacity: Number(r.capacity),
    shape: (r.shape as RestaurantTable["shape"]) ?? "square",
    type: (r.type as RestaurantTable["type"]) ?? "standard",
    allows_sharing: (r.allowsSharing as boolean | null) ?? false,
    status: r.status as TableStatus,
    is_active: (r.isActive as boolean | null) ?? true,
    sort_order: Number(r.sortOrder ?? 0),
    x_mm: Number(r.xMm ?? 0),
    y_mm: Number(r.yMm ?? 0),
    w_mm: Number(r.wMm ?? 800),
    h_mm: Number(r.hMm ?? 800),
    rotation_deg: Number(r.rotationDeg ?? 0),
    z_index: Number(r.zIndex ?? 0),
    deleted_at: isoOrNull(r.deletedAt),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    version: Number(r.version ?? 1),
  };
}

function toClientGroup(
  g: Record<string, any>,
  table?: { number?: unknown; code?: unknown; capacity?: unknown },
  floorName?: string,
): OccupancyGroup {
  return {
    id: String(g.id),
    table_id: String(g.tableId),
    outlet_id: String(g.outletId),
    floor_id: String(g.floorId ?? ""),
    seats: Number(g.seats),
    label: (g.label as string | null) ?? undefined,
    color_index: Number(g.colorIndex ?? 0),
    order_id: (g.orderId as string | null) ?? null,
    status: g.status as OccupancyGroup["status"],
    seated_at: iso(g.seatedAt),
    released_at: isoOrUndef(g.releasedAt),
    release_reason: (g.releaseReason as string | null) ?? undefined,
    force_released: (g.forceReleased as boolean | undefined) ?? undefined,
    floor_name_snapshot: floorName,
    table_number_snapshot: table?.number != null ? String(table.number) : undefined,
    table_code_snapshot: table?.code != null ? String(table.code) : undefined,
    capacity_at_seating: table?.capacity != null ? Number(table.capacity) : undefined,
    created_at: iso(g.createdAt),
    updated_at: iso(g.updatedAt),
    version: Number(g.version ?? 1),
  };
}

function toClientBlock(b: Record<string, any>): TableBlock {
  return {
    id: String(b.id),
    table_id: String(b.tableId),
    outlet_id: String(b.outletId),
    reason: String(b.reason ?? ""),
    blocked_at: iso(b.blockedAt),
    blocked_by: (b.blockedBy as string | null) ?? undefined,
    until_at: isoOrUndef(b.untilAt),
    released_at: isoOrUndef(b.releasedAt),
    released_by: (b.releasedBy as string | null) ?? undefined,
    created_at: iso(b.createdAt),
  };
}

function toClientHold(h: Record<string, any>): ReservationHold {
  return {
    id: String(h.id),
    table_id: String(h.tableId),
    outlet_id: String(h.outletId),
    holder_name: String(h.holderName ?? ""),
    holder_phone: (h.holderPhone as string | null) ?? undefined,
    party_size: Number(h.partySize),
    hold_from: iso(h.holdFrom),
    hold_until: iso(h.holdUntil),
    status: h.status as ReservationHold["status"],
    cancelled_by: (h.cancelledBy as string | null) ?? undefined,
    cancelled_at: isoOrUndef(h.cancelledAt),
    created_at: iso(h.createdAt),
    version: Number(h.version ?? 1),
  };
}

function assertOutlet(entityOutletId: string | undefined | null, ctx: ServerCtx, what: string) {
  if (ctx.outletId && entityOutletId && entityOutletId !== ctx.outletId) {
    throw new Error(`${what} belongs to another outlet`);
  }
}

async function activeGroupsForTableIds(
  organizationId: string,
  tableIds: string[],
): Promise<Record<string, any>[]> {
  if (tableIds.length === 0) return [];
  return (await db()
    .select()
    .from(occupancyGroups)
    .where(
      and(
        eq(occupancyGroups.organizationId, organizationId),
        inArray(occupancyGroups.tableId, tableIds),
        inArray(occupancyGroups.status, ["SEATED", "ORDERING"]),
      ),
    )) as unknown as Record<string, any>[];
}

async function activeBlockMap(
  organizationId: string,
  tableIds: string[],
): Promise<Map<string, Record<string, any>>> {
  const out = new Map<string, Record<string, any>>();
  if (tableIds.length === 0) return out;
  const rows = (await db()
    .select()
    .from(tableBlocks)
    .where(
      and(eq(tableBlocks.organizationId, organizationId), inArray(tableBlocks.tableId, tableIds)),
    )) as unknown as Record<string, any>[];
  for (const r of rows) {
    if (!r.releasedAt && !out.has(String(r.tableId))) out.set(String(r.tableId), r);
  }
  return out;
}

async function activeHoldMap(
  organizationId: string,
  tableIds: string[],
): Promise<Map<string, Record<string, any>>> {
  const out = new Map<string, Record<string, any>>();
  if (tableIds.length === 0) return out;
  const rows = (await db()
    .select()
    .from(reservationHolds)
    .where(
      and(
        eq(reservationHolds.organizationId, organizationId),
        inArray(reservationHolds.tableId, tableIds),
        eq(reservationHolds.status, "HELD"),
      ),
    )) as unknown as Record<string, any>[];
  for (const r of rows) if (!out.has(String(r.tableId))) out.set(String(r.tableId), r);
  return out;
}

function enrichRows(
  rows: Record<string, any>[],
  groupsByTable: Map<string, Record<string, any>[]>,
  blocks: Map<string, Record<string, any>>,
  holds: Map<string, Record<string, any>>,
): TableWithDerived[] {
  return rows.map((t) => {
    const tid = String(t.id);
    const active = (groupsByTable.get(tid) ?? []).map((g) => toClientGroup(g, t));
    const table = toClientTable(t);
    const block = blocks.has(tid) ? toClientBlock(blocks.get(tid)!) : undefined;
    const hold = holds.has(tid) ? toClientHold(holds.get(tid)!) : undefined;
    const info = deriveTableInfo(table, active, block, hold);
    return {
      ...table,
      occupancy_fill: info.occupancyFill,
      seated_seats: info.seatedSeats,
      active_groups: active,
      active_block: block,
      active_hold: hold,
    };
  });
}

async function enrichTables(
  organizationId: string,
  rows: Record<string, any>[],
): Promise<TableWithDerived[]> {
  const ids = rows.map((r) => String(r.id));
  const [groups, blocks, holds] = await Promise.all([
    activeGroupsForTableIds(organizationId, ids),
    activeBlockMap(organizationId, ids),
    activeHoldMap(organizationId, ids),
  ]);
  const byTable = new Map<string, Record<string, any>[]>();
  for (const g of groups) {
    const k = String(g.tableId);
    if (!byTable.has(k)) byTable.set(k, []);
    byTable.get(k)!.push(g);
  }
  return enrichRows(rows, byTable, blocks, holds);
}

async function transitionTableRow(
  row: Record<string, any>,
  to: TableStatus,
  opts: { actorId?: string; reason_code?: string; reason_text?: string; event_type?: string },
  organizationId: string,
): Promise<Record<string, any>> {
  const from = String(row.status) as TableStatus;
  if (from === to) return row;
  if (!canTransition(from, to)) throw new Error(`Illegal table transition ${from} → ${to}`);
  const [updated] = await db()
    .update(tables)
    .set({ status: to, updatedAt: new Date(), version: Number(row.version ?? 1) + 1 })
    .where(and(eq(tables.id, String(row.id)), eq(tables.organizationId, organizationId)))
    .returning();
  await recordServerEvent({
    outlet_id: String(row.outletId),
    organization_id: organizationId,
    entity_type: "TABLE",
    entity_id: String(row.id),
    event_type: opts.event_type ?? "TABLE_UPDATED",
    from_state: from,
    to_state: to,
    actor_id: opts.actorId,
    reason_code: opts.reason_code,
    reason_text: opts.reason_text,
  });
  return updated as unknown as Record<string, any>;
}

async function loadTableRow(
  id: string,
  organizationId: string,
): Promise<Record<string, any> | null> {
  const rows = await db()
    .select()
    .from(tables)
    .where(and(eq(tables.id, id), eq(tables.organizationId, organizationId)))
    .limit(1);
  const row = (rows[0] ?? null) as Record<string, any> | null;
  if (!row || row.deletedAt) return null;
  return row;
}

/* ---------------- reads ---------------- */

export async function getTables(
  organizationId: string,
  filters?: Omit<TableFilters, "outlet_id"> & { outlet_id?: string | null },
): Promise<TableWithDerived[]> {
  const conds = [eq(tables.organizationId, organizationId), isNull(tables.deletedAt)];
  if (filters?.outlet_id) conds.push(eq(tables.outletId, filters.outlet_id));
  if (filters?.floor_id) conds.push(eq(tables.floorId, filters.floor_id));
  if (filters?.status) conds.push(eq(tables.status, filters.status));
  if (filters?.is_active !== undefined) conds.push(eq(tables.isActive, filters.is_active));
  let rows = (await db()
    .select()
    .from(tables)
    .where(and(...conds))) as unknown as Record<string, any>[];
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r.number ?? "")
          .toLowerCase()
          .includes(q) ||
        String(r.code ?? "")
          .toLowerCase()
          .includes(q),
    );
  }
  rows.sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  return enrichTables(organizationId, rows);
}

export async function getTableById(
  id: string,
  organizationId: string,
): Promise<TableWithDerived | null> {
  const row = await loadTableRow(id, organizationId);
  if (!row) return null;
  return (await enrichTables(organizationId, [row]))[0] ?? null;
}

export async function getTablesWithDerivedByFloor(
  floorId: string,
  organizationId: string,
): Promise<{
  tables: TableWithDerived[];
  groups: import("./types").OccupancyGroup[];
  blocks: TableBlock[];
  holds: ReservationHold[];
}> {
  const rows = (await db()
    .select()
    .from(tables)
    .where(
      and(
        eq(tables.organizationId, organizationId),
        eq(tables.floorId, floorId),
        isNull(tables.deletedAt),
      ),
    )) as unknown as Record<string, any>[];
  const ids = rows.map((r) => String(r.id));
  const [groups, blocks, holds] = await Promise.all([
    activeGroupsForTableIds(organizationId, ids),
    activeBlockMap(organizationId, ids),
    activeHoldMap(organizationId, ids),
  ]);
  const byTable = new Map<string, Record<string, any>[]>();
  for (const g of groups) {
    const k = String(g.tableId);
    if (!byTable.has(k)) byTable.set(k, []);
    byTable.get(k)!.push(g);
  }
  return {
    tables: enrichRows(rows, byTable, blocks, holds),
    groups: groups.map((g) => toClientGroup(g)),
    blocks: [...blocks.values()].map(toClientBlock),
    holds: [...holds.values()].map(toClientHold),
  };
}

/* ---------------- table CRUD + pose ---------------- */

export async function createTable(
  payload: TablePayload,
  ctx: ServerCtx,
): Promise<TableWithDerived> {
  const outletId = payload.outlet_id ?? ctx.outletId ?? undefined;
  if (!outletId) throw new Error("No outlet selected — create one first");
  const existing = await db()
    .select({ id: tables.id, code: tables.code })
    .from(tables)
    .where(and(eq(tables.organizationId, ctx.organizationId), isNull(tables.deletedAt)));
  if (existing.some((t) => t.code.toUpperCase() === payload.code.toUpperCase())) {
    throw new Error(`Table code "${payload.code}" already exists in this outlet`);
  }
  const now = new Date();
  const [row] = await db()
    .insert(tables)
    .values({
      id: ulid(),
      organizationId: ctx.organizationId,
      outletId,
      floorId: payload.floor_id,
      number: payload.number.toUpperCase(),
      code: payload.code.toUpperCase(),
      capacity: payload.capacity,
      shape: payload.shape ?? "square",
      type: ((payload as Record<string, unknown>).type as string) ?? "standard",
      allowsSharing: (payload as Record<string, unknown>).allows_sharing === true,
      status: "available",
      isActive: payload.is_active ?? true,
      sortOrder: payload.sort_order ?? existing.length + 1,
      xMm: Number((payload as Record<string, unknown>).x_mm ?? 0),
      yMm: Number((payload as Record<string, unknown>).y_mm ?? 0),
      wMm: Number((payload as Record<string, unknown>).w_mm ?? 800),
      hMm: Number((payload as Record<string, unknown>).h_mm ?? 800),
      rotationDeg: Number((payload as Record<string, unknown>).rotation_deg ?? 0),
      zIndex: Number((payload as Record<string, unknown>).z_index ?? 1),
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await recordServerEvent({
    outlet_id: outletId,
    organization_id: ctx.organizationId,
    entity_type: "TABLE",
    entity_id: row.id,
    event_type: "TABLE_CREATED",
    to_state: "available",
    actor_id: actorOf(ctx),
  });
  const created = await getTableById(row.id, ctx.organizationId);
  if (!created) throw new Error("Table created but could not be reloaded");
  return created;
}

export async function updateTable(
  id: string,
  payload: TablePayload,
  ctx: ServerCtx,
): Promise<TableWithDerived> {
  const current = await loadTableRow(id, ctx.organizationId);
  if (!current) throw new Error("Table not found");
  if (payload.outlet_id !== undefined && payload.outlet_id !== String(current.outletId)) {
    throw new Error("Table cannot move across outlets");
  }
  assertOutlet(String(current.outletId), ctx, "Table");
  const active = await activeGroupsForTableIds(ctx.organizationId, [id]);
  if (active.length > 0) {
    const seated = active.reduce((s, g) => s + Number(g.seats), 0);
    if (payload.capacity !== undefined && payload.capacity < seated) {
      throw new Error(`Cannot reduce capacity below current occupancy (${seated})`);
    }
    if ((payload as Record<string, unknown>).allows_sharing === false && active.length > 1) {
      throw new Error("Cannot disable sharing with multiple active groups");
    }
  }
  if (
    payload.floor_id !== undefined &&
    String(payload.floor_id) !== String(current.floorId) &&
    active.length > 0
  ) {
    throw new Error(
      "Cannot move table to another floor with active guests. Release or transfer groups first.",
    );
  }
  const [updated] = await db()
    .update(tables)
    .set({
      ...(payload.number !== undefined ? { number: payload.number.toUpperCase() } : {}),
      ...(payload.code !== undefined ? { code: payload.code.toUpperCase() } : {}),
      ...(payload.floor_id !== undefined ? { floorId: payload.floor_id } : {}),
      ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
      ...((payload as Record<string, unknown>).shape !== undefined
        ? { shape: (payload as Record<string, unknown>).shape as string }
        : {}),
      ...((payload as Record<string, unknown>).type !== undefined
        ? { type: (payload as Record<string, unknown>).type as string }
        : {}),
      ...((payload as Record<string, unknown>).allows_sharing !== undefined
        ? { allowsSharing: (payload as Record<string, unknown>).allows_sharing as boolean }
        : {}),
      ...((payload as Record<string, unknown>).is_active !== undefined
        ? { isActive: (payload as Record<string, unknown>).is_active as boolean }
        : {}),
      ...((payload as Record<string, unknown>).sort_order !== undefined
        ? { sortOrder: (payload as Record<string, unknown>).sort_order as number }
        : {}),
      updatedAt: new Date(),
      version: Number(current.version ?? 1) + 1,
    })
    .where(and(eq(tables.id, id), eq(tables.organizationId, ctx.organizationId)))
    .returning();
  await recordServerEvent({
    outlet_id: String((updated as Record<string, unknown>).outletId ?? current.outletId),
    organization_id: ctx.organizationId,
    entity_type: "TABLE",
    entity_id: id,
    event_type: "TABLE_UPDATED",
    actor_id: actorOf(ctx),
    metadata: { payload: payload as unknown as Record<string, unknown> },
  });
  const out = await getTableById(id, ctx.organizationId);
  if (!out) throw new Error("Table not found");
  return out;
}

export async function deleteTable(id: string, ctx: ServerCtx): Promise<void> {
  const current = await loadTableRow(id, ctx.organizationId);
  if (!current) throw new Error("Table not found");
  assertOutlet(String(current.outletId), ctx, "Table");
  const active = await activeGroupsForTableIds(ctx.organizationId, [id]);
  if (active.length > 0) throw new Error("Cannot delete table with active guests");
  await db()
    .update(tables)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(tables.id, id), eq(tables.organizationId, ctx.organizationId)));
  await recordServerEvent({
    outlet_id: String(current.outletId),
    organization_id: ctx.organizationId,
    entity_type: "TABLE",
    entity_id: id,
    event_type: "TABLE_DELETED",
    actor_id: actorOf(ctx),
  });
}

export async function setTablePose(
  id: string,
  params: { x_mm?: number; y_mm?: number; w_mm?: number; h_mm?: number; rotation_deg?: number },
  ctx: ServerCtx,
): Promise<void> {
  const current = await loadTableRow(id, ctx.organizationId);
  if (!current) return;
  assertOutlet(String(current.outletId), ctx, "Table");
  const patch: Record<string, unknown> = {};
  if (params.x_mm !== undefined && params.x_mm !== Number(current.xMm)) patch.xMm = params.x_mm;
  if (params.y_mm !== undefined && params.y_mm !== Number(current.yMm)) patch.yMm = params.y_mm;
  if (params.w_mm !== undefined && params.w_mm !== Number(current.wMm)) patch.wMm = params.w_mm;
  if (params.h_mm !== undefined && params.h_mm !== Number(current.hMm)) patch.hMm = params.h_mm;
  if (params.rotation_deg !== undefined && params.rotation_deg !== Number(current.rotationDeg))
    patch.rotationDeg = params.rotation_deg;
  const moved = patch.xMm !== undefined || patch.yMm !== undefined;
  const resized = patch.wMm !== undefined || patch.hMm !== undefined;
  const rotated = patch.rotationDeg !== undefined;
  if (!moved && !resized && !rotated) return;
  await db()
    .update(tables)
    .set({ ...patch, updatedAt: new Date(), version: Number(current.version ?? 1) + 1 })
    .where(and(eq(tables.id, id), eq(tables.organizationId, ctx.organizationId)));
  await recordServerEvent({
    outlet_id: String(current.outletId),
    organization_id: ctx.organizationId,
    entity_type: "TABLE",
    entity_id: id,
    event_type: resized ? "TABLE_RESIZED" : "TABLE_MOVED",
    actor_id: actorOf(ctx),
    metadata: { ...params },
  });
}

export async function moveTable(
  id: string,
  params: { x_mm: number; y_mm: number },
  ctx: ServerCtx,
): Promise<void> {
  return setTablePose(id, params, ctx);
}

export async function resizeTable(
  id: string,
  params: { w_mm: number; h_mm: number },
  ctx: ServerCtx,
): Promise<void> {
  return setTablePose(id, params, ctx);
}

export async function rotateTable(
  id: string,
  params: { rotation_deg: number },
  ctx: ServerCtx,
): Promise<void> {
  return setTablePose(id, params, ctx);
}

export function suggestUniqueTableValue(taken: Iterable<string>, base: string): string {
  const takenUpper = new Set([...taken].map((t) => t.toUpperCase()));
  const m = base.match(/^(.*?)(\d+)$/);
  let candidate: string | null = null;
  if (m) {
    const next = (parseInt(m[2], 10) + 1).toString().padStart(m[2].length, "0");
    candidate = `${m[1]}${next}`;
  }
  while (candidate) {
    if (!takenUpper.has(candidate.toUpperCase())) return candidate;
    const mm = candidate.match(/^(.*?)(\d+)$/);
    if (!mm) break;
    const nx = (parseInt(mm[2], 10) + 1).toString().padStart(mm[2].length, "0");
    candidate = `${mm[1]}${nx}`;
    if (candidate.length > base.length + 10) break;
  }
  const copyBase = `${base}-COPY`;
  if (!takenUpper.has(copyBase.toUpperCase())) return copyBase;
  for (let i = 2; i < 100; i++) {
    const c = `${copyBase}-${i}`;
    if (!takenUpper.has(c.toUpperCase())) return c;
  }
  throw new Error(`Cannot suggest a unique value for "${base}" — too many copies`);
}

/* ---------------- occupancy ---------------- */

async function getGroupRow(
  id: string,
  organizationId: string,
): Promise<Record<string, any> | null> {
  const rows = await db()
    .select()
    .from(occupancyGroups)
    .where(and(eq(occupancyGroups.id, id), eq(occupancyGroups.organizationId, organizationId)))
    .limit(1);
  return (rows[0] ?? null) as unknown as Record<string, any> | null;
}

export async function getOccupancyGroup(
  id: string,
  organizationId: string,
): Promise<import("./types").OccupancyGroup | null> {
  const g = await getGroupRow(id, organizationId);
  return g ? toClientGroup(g) : null;
}

export async function seatOccupancy(params: {
  table_id: string;
  seats: number;
  created_by?: string;
  hold_id?: string;
  force?: boolean;
  reason?: string;
  group_id?: string;
  ctx: ServerCtx;
}): Promise<import("./types").OccupancyGroup> {
  const { ctx } = params;
  if (params.group_id) {
    const existing = await getGroupRow(params.group_id, ctx.organizationId);
    if (existing) return toClientGroup(existing);
  }
  const table = await loadTableRow(params.table_id, ctx.organizationId);
  if (!table) throw new Error("Table not found");
  assertOutlet(String(table.outletId), ctx, "Table");
  if (!Number.isInteger(params.seats) || params.seats < 1) {
    throw new Error("Seats must be a positive integer");
  }
  if (String(table.status) === "out_of_service") throw new Error("Table is out of service");
  if (String(table.status) === "cleaning")
    throw new Error("Table is being cleaned. Mark it cleaned first.");
  const liveBlock = (
    await db()
      .select()
      .from(tableBlocks)
      .where(
        and(
          eq(tableBlocks.organizationId, ctx.organizationId),
          eq(tableBlocks.tableId, String(table.id)),
          isNull(tableBlocks.releasedAt),
        ),
      )
      .limit(1)
  )[0] as Record<string, any> | undefined;
  if (liveBlock && !params.force) {
    throw new Error(
      `Table is blocked (${liveBlock.reason}). Unblock it first or force with a reason.`,
    );
  }
  const active = await activeGroupsForTableIds(ctx.organizationId, [String(table.id)]);
  if (!table.allowsSharing && active.length > 0) throw new Error("Table does not allow sharing");
  const currentSeated = active.reduce((s, g) => s + Number(g.seats), 0);
  if (currentSeated + params.seats > Number(table.capacity)) {
    throw new Error(
      `Insufficient capacity. Only ${Number(table.capacity) - currentSeated} seats available.`,
    );
  }
  // Hold consume-by-identity.
  let consumedHoldId: string | undefined;
  if (params.hold_id) {
    const holds = (await db()
      .select()
      .from(reservationHolds)
      .where(
        and(
          eq(reservationHolds.id, params.hold_id),
          eq(reservationHolds.organizationId, ctx.organizationId),
        ),
      )
      .limit(1)) as unknown as Record<string, any>[];
    const hold = holds[0];
    if (!hold || String(hold.tableId) !== String(table.id) || String(hold.status) !== "HELD") {
      throw new Error("Reservation hold is not available for seating");
    }
    const nowIso = new Date().toISOString();
    const from = hold.holdFrom ? new Date(String(hold.holdFrom)).toISOString() : "";
    const until = hold.holdUntil ? new Date(String(hold.holdUntil)).toISOString() : "";
    if (nowIso < from || nowIso > until)
      throw new Error("Reservation hold is outside its time window");
    await db()
      .update(reservationHolds)
      .set({ status: "SEATED" })
      .where(eq(reservationHolds.id, String(hold.id)));
    consumedHoldId = String(hold.id);
  } else {
    const liveHolds = (await db()
      .select()
      .from(reservationHolds)
      .where(
        and(
          eq(reservationHolds.organizationId, ctx.organizationId),
          eq(reservationHolds.tableId, String(table.id)),
          eq(reservationHolds.status, "HELD"),
        ),
      )) as unknown as Record<string, any>[];
    if (liveHolds.length === 1) {
      await db()
        .update(reservationHolds)
        .set({ status: "SEATED" })
        .where(eq(reservationHolds.id, String(liveHolds[0].id)));
      consumedHoldId = String(liveHolds[0].id);
    }
  }
  const siblingLabels = active.map((g) => (g.label as string | undefined) ?? undefined);
  const now = new Date();
  const [group] = await db()
    .insert(occupancyGroups)
    .values({
      id: params.group_id ?? ulid(),
      organizationId: ctx.organizationId,
      outletId: String(table.outletId),
      tableId: String(table.id),
      floorId: String(table.floorId),
      seats: params.seats,
      label: nextPartyLabel(siblingLabels),
      colorIndex: active.length % 8,
      orderId: null,
      status: "SEATED",
      seatedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
    })
    .returning();
  if (String(table.status) === "available" || String(table.status) === "reserved") {
    await transitionTableRow(
      table,
      "occupied",
      { actorId: ctx.actorId ?? params.created_by },
      ctx.organizationId,
    );
  }
  await recordServerEvent({
    outlet_id: String(table.outletId),
    organization_id: ctx.organizationId,
    entity_type: "OCCUPANCY_GROUP",
    entity_id: group.id,
    event_type: "OCCUPANCY_SEATED",
    to_state: "SEATED",
    actor_id: ctx.actorId ?? params.created_by,
    reason_text: params.force ? params.reason : undefined,
    metadata: { table_id: String(table.id), seats: params.seats, hold_id: consumedHoldId },
  });
  return toClientGroup(
    group as unknown as Record<string, any>,
    table as unknown as Record<string, unknown>,
  );
}

export async function releaseOccupancy(params: {
  group_id: string;
  released_by?: string;
  reason: string;
  force?: boolean;
  ctx: ServerCtx;
}): Promise<void> {
  const { ctx } = params;
  if (!params.reason?.trim()) throw new Error("A reason is required to release occupancy");
  const group = await getGroupRow(params.group_id, ctx.organizationId);
  if (!group) throw new Error("Group not found");
  if (String(group.status) === "RELEASED" || String(group.status) === "CANCELLED") return;
  assertOutlet(String(group.outletId), ctx, "Occupancy group");
  const forced = !!params.force;
  const now = new Date();
  await db()
    .update(occupancyGroups)
    .set({
      status: "RELEASED",
      releasedAt: now,
      releasedBy: params.released_by ?? ctx.actorId ?? null,
      releaseReason: params.reason,
      forceReleased: forced || undefined,
      updatedAt: now,
      version: Number(group.version ?? 1) + 1,
    })
    .where(
      and(
        eq(occupancyGroups.id, params.group_id),
        eq(occupancyGroups.organizationId, ctx.organizationId),
      ),
    );
  const remaining = await activeGroupsForTableIds(ctx.organizationId, [String(group.tableId)]);
  const stillActive = remaining.filter((g) => String(g.id) !== String(group.id));
  if (stillActive.length === 0) {
    const table = await loadTableRow(String(group.tableId), ctx.organizationId);
    if (table && String(table.status) === "occupied") {
      const to = group.orderId ? "available" : "cleaning";
      await transitionTableRow(
        table,
        to as TableStatus,
        {
          actorId: params.released_by,
          event_type: to === "available" ? "TABLE_UPDATED" : "TABLE_CLEANING_STARTED",
        },
        ctx.organizationId,
      );
    }
  }
  await recordServerEvent({
    outlet_id: String(group.outletId),
    organization_id: ctx.organizationId,
    entity_type: "OCCUPANCY_GROUP",
    entity_id: String(group.id),
    event_type: forced ? "OCCUPANCY_FORCE_RELEASED" : "OCCUPANCY_RELEASED",
    from_state: String(group.status),
    to_state: "RELEASED",
    actor_id: ctx.actorId ?? params.released_by,
    reason_text: params.reason,
    metadata: (group as Record<string, any>).orderId
      ? { order_id: (group as Record<string, any>).orderId }
      : undefined,
  });
}

export async function forceReleaseOccupancy(params: {
  group_id: string;
  released_by?: string;
  reason: string;
  ctx: ServerCtx;
}): Promise<void> {
  if (!params.reason?.trim()) throw new Error("A reason is required for force release");
  return releaseOccupancy({ ...params, force: true });
}

export async function addGuests(params: {
  group_id: string;
  extra_seats: number;
  ctx: ServerCtx;
}): Promise<import("./types").OccupancyGroup> {
  const { ctx } = params;
  const group = await getGroupRow(params.group_id, ctx.organizationId);
  if (!group) throw new Error("Group not found");
  if (String(group.status) !== "SEATED" && String(group.status) !== "ORDERING") {
    throw new Error("Can only add guests to an active group");
  }
  assertOutlet(String(group.outletId), ctx, "Occupancy group");
  if (!Number.isInteger(params.extra_seats) || params.extra_seats < 1) {
    throw new Error("Extra seats must be a positive integer");
  }
  const table = await loadTableRow(String(group.tableId), ctx.organizationId);
  if (!table) throw new Error("Table not found");
  const others = await activeGroupsForTableIds(ctx.organizationId, [String(table.id)]);
  const seatedOthers = others
    .filter((g) => String(g.id) !== String(group.id))
    .reduce((s, g) => s + Number(g.seats), 0);
  if (seatedOthers + Number(group.seats) + params.extra_seats > Number(table.capacity)) {
    throw new Error(
      `Insufficient capacity. Only ${Number(table.capacity) - seatedOthers - Number(group.seats)} seats available.`,
    );
  }
  const [updated] = await db()
    .update(occupancyGroups)
    .set({
      seats: Number(group.seats) + params.extra_seats,
      updatedAt: new Date(),
      version: Number(group.version ?? 1) + 1,
    })
    .where(
      and(
        eq(occupancyGroups.id, String(group.id)),
        eq(occupancyGroups.organizationId, ctx.organizationId),
      ),
    )
    .returning();
  await recordServerEvent({
    outlet_id: String(group.outletId),
    organization_id: ctx.organizationId,
    entity_type: "OCCUPANCY_GROUP",
    entity_id: String(group.id),
    event_type: "OCCUPANCY_GUESTS_ADDED",
    actor_id: actorOf(ctx),
    metadata: {
      extra_seats: params.extra_seats,
      total_seats: Number(group.seats) + params.extra_seats,
    },
  });
  return toClientGroup(
    updated as unknown as Record<string, any>,
    table as unknown as Record<string, unknown>,
  );
}

export async function attachOrder(params: {
  group_id: string;
  order_id: string;
  ctx: ServerCtx;
}): Promise<import("./types").OccupancyGroup> {
  const { ctx } = params;
  const group = await getGroupRow(params.group_id, ctx.organizationId);
  if (!group) throw new Error("Group not found");
  if (String(group.status) !== "SEATED") throw new Error("Order can only attach to a SEATED group");
  if (group.orderId) throw new Error("Group already has an order attached");
  if (!params.order_id?.trim()) throw new Error("order_id is required");
  assertOutlet(String(group.outletId), ctx, "Occupancy group");
  const [updated] = await db()
    .update(occupancyGroups)
    .set({
      orderId: params.order_id,
      status: "ORDERING",
      updatedAt: new Date(),
      version: Number(group.version ?? 1) + 1,
    })
    .where(
      and(
        eq(occupancyGroups.id, String(group.id)),
        eq(occupancyGroups.organizationId, ctx.organizationId),
      ),
    )
    .returning();
  await recordServerEvent({
    outlet_id: String(group.outletId),
    organization_id: ctx.organizationId,
    entity_type: "OCCUPANCY_GROUP",
    entity_id: String(group.id),
    event_type: "OCCUPANCY_ORDER_ATTACHED",
    from_state: "SEATED",
    to_state: "ORDERING",
    actor_id: actorOf(ctx),
    metadata: { order_id: params.order_id },
  });
  return toClientGroup(updated as unknown as Record<string, any>);
}

export async function detachOrder(params: {
  group_id: string;
  order_id: string;
  ctx: ServerCtx;
}): Promise<void> {
  const { ctx } = params;
  const group = await getGroupRow(params.group_id, ctx.organizationId);
  if (!group) return;
  if (String(group.orderId) !== params.order_id) return;
  assertOutlet(String(group.outletId), ctx, "Occupancy group");
  await db()
    .update(occupancyGroups)
    .set({
      orderId: null,
      status: String(group.status) === "ORDERING" ? "SEATED" : String(group.status),
      updatedAt: new Date(),
      version: Number(group.version ?? 1) + 1,
    })
    .where(
      and(
        eq(occupancyGroups.id, String(group.id)),
        eq(occupancyGroups.organizationId, ctx.organizationId),
      ),
    );
  await recordServerEvent({
    outlet_id: String(group.outletId),
    organization_id: ctx.organizationId,
    entity_type: "OCCUPANCY_GROUP",
    entity_id: String(group.id),
    event_type: "OCCUPANCY_ORDER_DETACHED",
    from_state: "ORDERING",
    to_state: "SEATED",
    actor_id: actorOf(ctx),
    metadata: { order_id: params.order_id },
  });
}

export async function cancelOccupancy(params: {
  group_id: string;
  by?: string;
  reason: string;
  ctx: ServerCtx;
}): Promise<void> {
  const { ctx } = params;
  const group = await getGroupRow(params.group_id, ctx.organizationId);
  if (!group) throw new Error("Group not found");
  if (String(group.status) === "RELEASED" || String(group.status) === "CANCELLED") return;
  const actorId = params.by ?? ctx.actorId;
  assertOutlet(String(group.outletId), { ...ctx, actorId } as ServerCtx, "Occupancy group");
  if ((group as Record<string, any>).orderId) {
    throw new Error("Group has an order. Cancel it through the orders module first.");
  }
  if (!params.reason?.trim()) throw new Error("A reason is required to cancel occupancy");
  const now = new Date();
  await db()
    .update(occupancyGroups)
    .set({
      status: "CANCELLED",
      releasedAt: now,
      releasedBy: actorId ?? null,
      releaseReason: params.reason,
      updatedAt: now,
      version: Number(group.version ?? 1) + 1,
    })
    .where(
      and(
        eq(occupancyGroups.id, String(group.id)),
        eq(occupancyGroups.organizationId, ctx.organizationId),
      ),
    );
  await recordServerEvent({
    outlet_id: String(group.outletId),
    organization_id: ctx.organizationId,
    entity_type: "OCCUPANCY_GROUP",
    entity_id: String(group.id),
    event_type: "OCCUPANCY_CANCELLED",
    from_state: String(group.status),
    to_state: "CANCELLED",
    actor_id: actorId,
    reason_text: params.reason,
  });
}

export async function transferOccupancy(params: {
  group_ids: string[];
  to_table_id: string;
  moved_by?: string;
  reason: string;
  ctx: ServerCtx;
}): Promise<import("./types").OccupancyGroup[]> {
  const { ctx } = params;
  if (!params.group_ids.length) throw new Error("At least one group is required");
  if (!params.reason?.trim()) throw new Error("A reason is required for transfer");
  const actorId = params.moved_by ?? ctx.actorId;
  const groups: Record<string, any>[] = [];
  for (const id of params.group_ids) {
    const g = await getGroupRow(id, ctx.organizationId);
    if (!g) throw new Error(`Group not found: ${id}`);
    groups.push(g);
  }
  const dest = await loadTableRow(params.to_table_id, ctx.organizationId);
  if (!dest) throw new Error("Destination table not found");
  assertOutlet(String(dest.outletId), { ...ctx, actorId } as ServerCtx, "Destination table");
  if (String(dest.status) === "out_of_service" || String(dest.status) === "cleaning") {
    throw new Error(`Destination table is ${String(dest.status).replace("_", " ")}`);
  }
  const destBlock = (
    await db()
      .select()
      .from(tableBlocks)
      .where(
        and(
          eq(tableBlocks.organizationId, ctx.organizationId),
          eq(tableBlocks.tableId, String(dest.id)),
          isNull(tableBlocks.releasedAt),
        ),
      )
      .limit(1)
  )[0];
  if (destBlock)
    throw new Error(`Destination table is blocked (${(destBlock as Record<string, any>).reason})`);
  const sourceIds = [...new Set(groups.map((g) => String(g.tableId)))];
  for (const g of groups) {
    assertOutlet(String(g.outletId), { ...ctx, actorId } as ServerCtx, "Occupancy group");
    if (String(g.status) !== "SEATED" && String(g.status) !== "ORDERING") {
      throw new Error(`Group ${String(g.id)} is not active`);
    }
    if (String(g.tableId) === String(dest.id))
      throw new Error("Group is already on the destination table");
  }
  const movingSeats = groups.reduce((s, g) => s + Number(g.seats), 0);
  const destActive = await activeGroupsForTableIds(ctx.organizationId, [String(dest.id)]);
  const destActiveOthers = destActive.filter(
    (g) => !groups.some((m) => String(m.id) === String(g.id)),
  );
  const destSeated = destActiveOthers.reduce((s, g) => s + Number(g.seats), 0);
  if (destSeated + movingSeats > Number(dest.capacity)) {
    throw new Error(
      `Destination table has only ${Number(dest.capacity) - destSeated} seats available.`,
    );
  }
  if (!dest.allowsSharing && destActiveOthers.length + groups.length > 1) {
    throw new Error("Destination table does not allow sharing");
  }
  const orderIds = [...new Set(groups.map((g) => g.orderId).filter(Boolean))];
  if (orderIds.length > 1) {
    throw new Error("Cannot merge groups with different orders. Split or settle them first.");
  }
  const now = new Date();
  const moved: Record<string, any>[] = [];
  for (const g of groups) {
    const [updated] = await db()
      .update(occupancyGroups)
      .set({
        tableId: String(dest.id),
        floorId: String(dest.floorId),
        updatedAt: now,
        version: Number(g.version ?? 1) + 1,
      })
      .where(
        and(
          eq(occupancyGroups.id, String(g.id)),
          eq(occupancyGroups.organizationId, ctx.organizationId),
        ),
      )
      .returning();
    moved.push(updated as unknown as Record<string, any>);
    await recordServerEvent({
      outlet_id: String(dest.outletId),
      organization_id: ctx.organizationId,
      entity_type: "OCCUPANCY_GROUP",
      entity_id: String(g.id),
      event_type: "OCCUPANCY_TRANSFERRED",
      actor_id: actorId,
      reason_text: params.reason,
      metadata: { from_table_id: String(g.tableId), to_table_id: String(dest.id) },
    });
  }
  for (const srcId of sourceIds) {
    const remaining = await activeGroupsForTableIds(ctx.organizationId, [srcId]);
    if (remaining.length === 0) {
      const src = await loadTableRow(srcId, ctx.organizationId);
      if (src && String(src.status) === "occupied") {
        await transitionTableRow(src, "cleaning", { actorId }, ctx.organizationId);
      }
    }
  }
  if (String(dest.status) === "available" || String(dest.status) === "reserved") {
    await transitionTableRow(dest, "occupied", { actorId }, ctx.organizationId);
  }
  return moved.map((m) => toClientGroup(m));
}

export async function markCleaned(params: {
  table_id: string;
  by?: string;
  ctx: ServerCtx;
}): Promise<TableWithDerived> {
  const { ctx } = params;
  const table = await loadTableRow(params.table_id, ctx.organizationId);
  if (!table) throw new Error("Table not found");
  assertOutlet(
    String(table.outletId),
    { ...ctx, actorId: params.by ?? ctx.actorId } as never,
    "Table",
  );
  if (String(table.status) === "available") {
    const out = await getTableById(params.table_id, ctx.organizationId);
    if (!out) throw new Error("Table not found");
    return out;
  }
  if (String(table.status) !== "cleaning") {
    throw new Error("Only cleaning tables can be marked cleaned — release the party first");
  }
  await transitionTableRow(
    table,
    "available",
    { actorId: params.by ?? ctx.actorId, event_type: "TABLE_CLEANING_COMPLETED" },
    ctx.organizationId,
  );
  const out = await getTableById(params.table_id, ctx.organizationId);
  if (!out) throw new Error("Table not found");
  return out;
}

export async function setTableStatus(params: {
  table_id: string;
  to: TableStatus;
  reason: string;
  by?: string;
  ctx: ServerCtx;
}): Promise<TableWithDerived> {
  const { ctx } = params;
  const table = await loadTableRow(params.table_id, ctx.organizationId);
  if (!table) throw new Error("Table not found");
  assertOutlet(
    String(table.outletId),
    { ...ctx, actorId: params.by ?? ctx.actorId } as never,
    "Table",
  );
  if (!params.reason?.trim()) throw new Error("A reason is required to change table status");
  if (String(table.status) === params.to) {
    const out = await getTableById(params.table_id, ctx.organizationId);
    if (!out) throw new Error("Table not found");
    return out;
  }
  if (String(table.status) === "occupied" && params.to === "available") {
    throw new Error(
      "Release guests first — occupied tables clear via release → cleaning → mark cleaned",
    );
  }
  await transitionTableRow(
    table,
    params.to,
    {
      actorId: params.by ?? ctx.actorId,
      reason_text: params.reason.trim(),
      event_type: "TABLE_STATUS_SET",
    },
    ctx.organizationId,
  );
  const out = await getTableById(params.table_id, ctx.organizationId);
  if (!out) throw new Error("Table not found");
  return out;
}

export async function blockTable(params: {
  table_id: string;
  reason: string;
  by?: string;
  until_at?: string;
  ctx: ServerCtx;
}): Promise<TableBlock> {
  const { ctx } = params;
  const table = await loadTableRow(params.table_id, ctx.organizationId);
  if (!table) throw new Error("Table not found");
  assertOutlet(
    String(table.outletId),
    { ...ctx, actorId: params.by ?? ctx.actorId } as never,
    "Table",
  );
  if (!params.reason?.trim()) throw new Error("A reason is required to block a table");
  const live = await db()
    .select({ id: tableBlocks.id })
    .from(tableBlocks)
    .where(
      and(
        eq(tableBlocks.organizationId, ctx.organizationId),
        eq(tableBlocks.tableId, String(table.id)),
        isNull(tableBlocks.releasedAt),
      ),
    )
    .limit(1);
  if (live.length > 0) throw new Error("Table is already blocked");
  const now = new Date();
  const [block] = await db()
    .insert(tableBlocks)
    .values({
      id: ulid(),
      organizationId: ctx.organizationId,
      outletId: String(table.outletId),
      tableId: String(table.id),
      reason: params.reason,
      blockedAt: now,
      blockedBy: params.by ?? ctx.actorId ?? null,
      untilAt: params.until_at ? new Date(params.until_at) : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await recordServerEvent({
    outlet_id: String(table.outletId),
    organization_id: ctx.organizationId,
    entity_type: "TABLE",
    entity_id: String(table.id),
    event_type: "TABLE_BLOCKED",
    actor_id: ctx.actorId ?? params.by,
    reason_text: params.reason,
  });
  return toClientBlock(block as unknown as Record<string, any>);
}

export async function unblockTable(params: {
  table_id: string;
  by?: string;
  ctx: ServerCtx;
}): Promise<void> {
  const { ctx } = params;
  const table = await loadTableRow(params.table_id, ctx.organizationId);
  if (!table) throw new Error("Table not found");
  assertOutlet(
    String(table.outletId),
    { ...ctx, actorId: params.by ?? ctx.actorId } as never,
    "Table",
  );
  const live = (await db()
    .select()
    .from(tableBlocks)
    .where(
      and(
        eq(tableBlocks.organizationId, ctx.organizationId),
        eq(tableBlocks.tableId, String(table.id)),
        isNull(tableBlocks.releasedAt),
      ),
    )
    .limit(1)) as unknown as Record<string, any>[];
  if (!live.length) return;
  await db()
    .update(tableBlocks)
    .set({
      releasedAt: new Date(),
      releasedBy: params.by ?? ctx.actorId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tableBlocks.id, String(live[0].id)));
  await recordServerEvent({
    outlet_id: String(table.outletId),
    organization_id: ctx.organizationId,
    entity_type: "TABLE",
    entity_id: String(table.id),
    event_type: "TABLE_UNBLOCKED",
    actor_id: ctx.actorId ?? params.by,
  });
}

export async function createHold(params: {
  table_id: string;
  holder_name: string;
  holder_phone?: string;
  party_size: number;
  hold_from: string;
  hold_until: string;
  by?: string;
  ctx: ServerCtx;
}): Promise<ReservationHold> {
  const { ctx } = params;
  const table = await loadTableRow(params.table_id, ctx.organizationId);
  if (!table) throw new Error("Table not found");
  assertOutlet(
    String(table.outletId),
    { ...ctx, actorId: params.by ?? ctx.actorId } as never,
    "Table",
  );
  if (!params.holder_name?.trim()) throw new Error("Holder name is required");
  if (!Number.isInteger(params.party_size) || params.party_size < 1) {
    throw new Error("Party size must be a positive integer");
  }
  if (params.party_size > Number(table.capacity))
    throw new Error("Party size exceeds table capacity");
  if (params.hold_from >= params.hold_until) throw new Error("Hold window is invalid");
  if (String(table.status) === "out_of_service") throw new Error("Table is out of service");
  const blocked = await db()
    .select({ id: tableBlocks.id })
    .from(tableBlocks)
    .where(
      and(
        eq(tableBlocks.organizationId, ctx.organizationId),
        eq(tableBlocks.tableId, String(table.id)),
        isNull(tableBlocks.releasedAt),
      ),
    )
    .limit(1);
  if (blocked.length > 0) throw new Error("Table is blocked");
  const overlapping = (await db()
    .select({ holdFrom: reservationHolds.holdFrom, holdUntil: reservationHolds.holdUntil })
    .from(reservationHolds)
    .where(
      and(
        eq(reservationHolds.organizationId, ctx.organizationId),
        eq(reservationHolds.tableId, String(table.id)),
        eq(reservationHolds.status, "HELD"),
      ),
    )) as unknown as { holdFrom: unknown; holdUntil: unknown }[];
  const overlap = overlapping.some(
    (h) => params.hold_from < iso(h.holdUntil) && iso(h.holdFrom) < params.hold_until,
  );
  if (overlap) throw new Error("An overlapping hold already exists on this table");
  const now = new Date();
  const [hold] = await db()
    .insert(reservationHolds)
    .values({
      id: ulid(),
      organizationId: ctx.organizationId,
      outletId: String(table.outletId),
      tableId: String(table.id),
      holderName: params.holder_name.trim(),
      holderPhone: params.holder_phone,
      partySize: params.party_size,
      holdFrom: new Date(params.hold_from),
      holdUntil: new Date(params.hold_until),
      status: "HELD",
      createdAt: now,
      updatedAt: now,
      version: 1,
    })
    .returning();
  await recordServerEvent({
    outlet_id: String(table.outletId),
    organization_id: ctx.organizationId,
    entity_type: "RESERVATION",
    entity_id: hold.id,
    event_type: "OCCUPANCY_SEATED",
    actor_id: ctx.actorId ?? params.by,
    reason_code: "HOLD_CREATED",
    metadata: { table_id: String(table.id), party_size: params.party_size },
  });
  return toClientHold(hold as unknown as Record<string, any>);
}

export async function cancelHold(params: {
  hold_id: string;
  by?: string;
  reason?: string;
  ctx: ServerCtx;
}): Promise<void> {
  const { ctx } = params;
  const rows = (await db()
    .select()
    .from(reservationHolds)
    .where(
      and(
        eq(reservationHolds.id, params.hold_id),
        eq(reservationHolds.organizationId, ctx.organizationId),
      ),
    )
    .limit(1)) as unknown as Record<string, any>[];
  const hold = rows[0];
  if (!hold) throw new Error("Hold not found");
  if (String(hold.status) !== "HELD") return;
  assertOutlet(String(hold.outletId), ctx, "Reservation hold");
  await db()
    .update(reservationHolds)
    .set({
      status: "CANCELLED",
      cancelledBy: params.by ?? ctx.actorId ?? null,
      cancelledAt: new Date(),
      version: Number(hold.version ?? 1) + 1,
      updatedAt: new Date(),
    })
    .where(eq(reservationHolds.id, String(hold.id)));
  await recordServerEvent({
    outlet_id: String(hold.outletId),
    organization_id: ctx.organizationId,
    entity_type: "RESERVATION",
    entity_id: String(hold.id),
    event_type: "OCCUPANCY_CANCELLED",
    actor_id: ctx.actorId ?? params.by,
    reason_code: "HOLD_CANCELLED",
    reason_text: params.reason,
  });
}

export async function expireHold(params: {
  hold_id: string;
  organizationId: string;
}): Promise<void> {
  const rows = (await db()
    .select()
    .from(reservationHolds)
    .where(
      and(
        eq(reservationHolds.id, params.hold_id),
        eq(reservationHolds.organizationId, params.organizationId),
      ),
    )
    .limit(1)) as unknown as Record<string, any>[];
  const hold = rows[0];
  if (!hold || String(hold.status) !== "HELD") return;
  await db()
    .update(reservationHolds)
    .set({ status: "EXPIRED", version: Number(hold.version ?? 1) + 1, updatedAt: new Date() })
    .where(eq(reservationHolds.id, String(hold.id)));
  await recordServerEvent({
    outlet_id: String(hold.outletId),
    organization_id: params.organizationId,
    entity_type: "RESERVATION",
    entity_id: String(hold.id),
    event_type: "OCCUPANCY_CANCELLED",
    reason_code: "HOLD_EXPIRED",
  });
}
