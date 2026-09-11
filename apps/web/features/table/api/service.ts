import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { entityMutex } from "@/lib/mutex";
import type {
  RestaurantTable,
  TableFilters,
  TablePayload,
  OccupancyGroup,
  TableBlock,
  ReservationHold,
  TableWithDerived,
  CommandContext,
} from "./types";
import { deriveTableInfo, canTransition } from "./utils";
import type { TableStatus } from "./types";

const DEFAULT_CTX: CommandContext = { outlet_id: "out_001", actor_id: "staff" };

function ctxOf(ctx?: Partial<CommandContext>): CommandContext {
  return { ...DEFAULT_CTX, ...ctx };
}

function assertOutlet(entityOutlet: string | undefined, ctx: CommandContext, what: string) {
  if (entityOutlet && entityOutlet !== ctx.outlet_id) {
    throw new Error(`${what} belongs to another outlet`);
  }
}

let mockTables: RestaurantTable[] = [
  {
    id: "tbl_001",
    outlet_id: "out_001",
    floor_id: "fl_001",
    floor_name: "Ground Floor",
    number: "101",
    code: "T101",
    capacity: 4,
    shape: "square",
    type: "standard",
    allows_sharing: false,
    status: "available",
    is_active: true,
    sort_order: 1,
    x_mm: 500,
    y_mm: 500,
    w_mm: 800,
    h_mm: 800,
    rotation_deg: 0,
    z_index: 1,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockGroups: OccupancyGroup[] = [];
let mockBlocks: TableBlock[] = [];
let mockHolds: ReservationHold[] = [];

// Persist mock state to localStorage so created tables/groups survive dev-server
// restarts (same PO_STORAGE_KEY pattern as inventory service).
const TABLE_STORAGE_KEY = "pixaTables";
function saveTables() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        TABLE_STORAGE_KEY,
        JSON.stringify({
          tables: mockTables,
          groups: mockGroups,
          blocks: mockBlocks,
          holds: mockHolds,
        }),
      );
    } catch {}
  }
}
function loadTables(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(TABLE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.tables) && parsed.tables.length > 0) {
          mockTables = parsed.tables;
        }
        if (Array.isArray(parsed?.groups)) {
          mockGroups = parsed.groups;
        }
        if (Array.isArray(parsed?.blocks)) {
          mockBlocks = parsed.blocks;
        }
        if (Array.isArray(parsed?.holds)) {
          mockHolds = parsed.holds;
        }
      }
    } catch {}
  }
}
// hydrate from storage on browser init
loadTables();

// Exported for layout read-model in floor-service
export { mockTables, mockGroups, mockBlocks, mockHolds };

/**
 * C1: single choke point for ALL table status writes.
 * Asserts the explicit transition map, bumps version, emits the event.
 */
async function transitionTable(
  idx: number,
  to: TableStatus,
  ctx: { actor_id?: string; reason_code?: string; reason_text?: string; event_type?: any },
): Promise<void> {
  const current = mockTables[idx];
  const from = current.status;
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new Error(`Illegal table transition ${from} → ${to}`);
  }
  const now = new Date().toISOString();
  mockTables[idx] = { ...current, status: to, updated_at: now, version: current.version + 1 };
  await recordEvent({
    outlet_id: current.outlet_id,
    entity_type: "TABLE",
    entity_id: current.id,
    event_type: ctx.event_type ?? "TABLE_UPDATED",
    from_state: from,
    to_state: to,
    actor_id: ctx.actor_id,
    reason_code: ctx.reason_code,
    reason_text: ctx.reason_text,
  });
}

function enrichTable(table: RestaurantTable): TableWithDerived {
  const activeGroups = mockGroups.filter(
    (g) => g.table_id === table.id && (g.status === "SEATED" || g.status === "ORDERING"),
  );
  const activeBlock = mockBlocks.find((b) => b.table_id === table.id && !b.released_at);
  const activeHold = mockHolds.find((h) => h.table_id === table.id && h.status === "HELD");

  const info = deriveTableInfo(table, activeGroups, activeBlock, activeHold);

  return {
    ...table,
    occupancy_fill: info.occupancyFill,
    seated_seats: info.seatedSeats,
    active_groups: activeGroups,
    active_block: activeBlock,
    active_hold: activeHold,
  };
}

export async function getTables(filters?: TableFilters): Promise<TableWithDerived[]> {
  await delay(300);
  let r = [...mockTables].filter((t) => !t.deleted_at);
  if (filters?.outlet_id) r = r.filter((t) => t.outlet_id === filters.outlet_id);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    r = r.filter((t) => t.number.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  }
  if (filters?.floor_id) r = r.filter((t) => t.floor_id === filters.floor_id);
  if (filters?.status) r = r.filter((t) => t.status === filters.status);
  if (filters?.is_active !== undefined) r = r.filter((t) => t.is_active === filters.is_active);

  return r.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(enrichTable);
}

export async function getTableById(id: string): Promise<TableWithDerived | null> {
  await delay(200);
  const t = mockTables.find((t) => t.id === id && !t.deleted_at);
  return t ? enrichTable(t) : null;
}

/**
 * C4: typed layout API for the floor module.
 * Floor service must compose through this — never the raw mock arrays.
 */
export async function getTablesWithDerivedByFloor(floorId: string): Promise<{
  tables: TableWithDerived[];
  groups: OccupancyGroup[];
  blocks: TableBlock[];
  holds: ReservationHold[];
}> {
  await delay(100);
  const tables = mockTables
    .filter((t) => t.floor_id === floorId && !t.deleted_at)
    .map(enrichTable);
  const tableIds = new Set(tables.map((t) => t.id));
  return {
    tables,
    groups: mockGroups.filter(
      (g) => tableIds.has(g.table_id) && (g.status === "SEATED" || g.status === "ORDERING"),
    ),
    blocks: mockBlocks.filter((b) => tableIds.has(b.table_id) && !b.released_at),
    holds: mockHolds.filter((h) => tableIds.has(h.table_id) && h.status === "HELD"),
  };
}

const DUPLICATE_POSE_OFFSET_MM = 200;

/** Bump a trailing number (T1 -> T2, T-GF01 -> T-GF02, zero-padded). Null when no trailing digits. */
function incrementTrailing(value: string): string | null {
  const m = value.match(/^(.*?)(\d+)$/);
  if (!m) return null;
  const next = String(parseInt(m[2], 10) + 1).padStart(m[2].length, "0");
  return `${m[1]}${next}`;
}

/**
 * Suggest the next free identifier for a duplicated table.
 * Tries trailing-number increment (T1 -> T2), then `-COPY` suffixes.
 * Comparison is case-insensitive; result keeps the source casing.
 */
export function suggestUniqueTableValue(base: string, taken: Iterable<string>): string {
  const takenUpper = new Set([...taken].map((t) => t.toUpperCase()));
  let candidate: string | null = incrementTrailing(base);
  for (let i = 0; i < 99 && candidate; i++) {
    if (!takenUpper.has(candidate.toUpperCase())) return candidate;
    candidate = incrementTrailing(candidate);
  }
  const copyBase = `${base}-COPY`;
  if (!takenUpper.has(copyBase.toUpperCase())) return copyBase;
  for (let i = 2; i < 100; i++) {
    const c = `${copyBase}-${i}`;
    if (!takenUpper.has(c.toUpperCase())) return c;
  }
  throw new Error(`Cannot suggest a unique value for "${base}" — too many copies`);
}

/** Prefill identifiers for the duplicate form: next free number + code within the outlet. */
export function suggestDuplicateIdentifiers(
  source: Pick<RestaurantTable, "outlet_id" | "number" | "code">,
  existing: Pick<RestaurantTable, "outlet_id" | "number" | "code" | "deleted_at">[],
): { number: string; code: string } {
  const outletTables = existing.filter(
    (t) => t.outlet_id === source.outlet_id && !t.deleted_at,
  );
  return {
    number: suggestUniqueTableValue(
      source.number,
      outletTables.map((t) => t.number),
    ),
    code: suggestUniqueTableValue(
      source.code,
      outletTables.map((t) => t.code),
    ),
  };
}

/**
 * One-click duplicate: copies layout + config from the source, resets lifecycle
 * (new id, status=available, version=1), offsets pose so the copy doesn't stack
 * on the original, and never copies occupancy. Emits TABLE_CREATED with
 * metadata.duplicated_from. For the review-before-save flow, the form instead
 * uses suggestDuplicateIdentifiers + createTable.
 */
export async function duplicateTable(
  id: string,
  overrides?: Partial<TablePayload>,
): Promise<TableWithDerived> {
  const release = await entityMutex.acquire("table-write");
  try {
    await delay(500);
    const source = mockTables.find((t) => t.id === id && !t.deleted_at);
    if (!source) throw new Error("Table not found");
    const outletId = overrides?.outlet_id ?? source.outlet_id;

    const outletTables = mockTables.filter(
      (t) => !t.deleted_at && t.outlet_id === outletId,
    );
    const number = (
      overrides?.number ?? suggestUniqueTableValue(source.number, outletTables.map((t) => t.number))
    ).toUpperCase();
    const code = (
      overrides?.code ?? suggestUniqueTableValue(source.code, outletTables.map((t) => t.code))
    ).toUpperCase();
    if (
      mockTables.some(
        (t) => !t.deleted_at && t.outlet_id === outletId && t.code.toUpperCase() === code,
      )
    ) {
      throw new Error(`Table code "${code}" already exists in this outlet`);
    }

    const now = new Date().toISOString();
    const table: RestaurantTable = {
      id: `tbl_${Date.now().toString(36)}`,
      outlet_id: outletId,
      floor_id: overrides?.floor_id ?? source.floor_id,
      number,
      code,
      capacity: overrides?.capacity ?? source.capacity,
      shape: (overrides?.shape as RestaurantTable["shape"]) ?? source.shape,
      type: ((overrides as any)?.type as RestaurantTable["type"]) ?? source.type,
      allows_sharing: (overrides as any)?.allows_sharing ?? source.allows_sharing,
      status: "available",
      is_active: overrides?.is_active ?? true,
      sort_order:
        overrides?.sort_order ?? Math.max(0, ...outletTables.map((t) => t.sort_order || 0)) + 1,
      x_mm: Math.max(0, source.x_mm + DUPLICATE_POSE_OFFSET_MM),
      y_mm: Math.max(0, source.y_mm + DUPLICATE_POSE_OFFSET_MM),
      w_mm: source.w_mm,
      h_mm: source.h_mm,
      rotation_deg: source.rotation_deg,
      z_index: source.z_index,
      version: 1,
      created_at: now,
      updated_at: now,
    };

    mockTables.push(table);
    saveTables();
    await recordEvent({
      outlet_id: table.outlet_id,
      entity_type: "TABLE",
      entity_id: table.id,
      event_type: "TABLE_CREATED",
      to_state: "available",
      metadata: { duplicated_from: id },
    });
    return enrichTable(table);
  } finally {
    release();
  }
}

export async function createTable(payload: TablePayload): Promise<TableWithDerived> {
  const release = await entityMutex.acquire("table-write");
  try {
    await delay(500);
    const outletId = payload.outlet_id ?? "out_001";
    if (
      mockTables.some(
        (t) =>
          !t.deleted_at &&
          t.outlet_id === outletId &&
          t.code.toUpperCase() === payload.code.toUpperCase(),
      )
    ) {
      throw new Error(`Table code "${payload.code}" already exists in this outlet`);
    }

    const now = new Date().toISOString();
    const table: RestaurantTable = {
      id: `tbl_${Date.now().toString(36)}`,
      outlet_id: outletId,
      floor_id: payload.floor_id,
      number: payload.number.toUpperCase(),
      code: payload.code.toUpperCase(),
      capacity: payload.capacity,
      shape: payload.shape ?? "square",
      type: (payload as any).type ?? "standard",
      allows_sharing: (payload as any).allows_sharing ?? false,
      status: "available",
      is_active: payload.is_active ?? true,
      sort_order: payload.sort_order ?? mockTables.length + 1,
      x_mm: (payload as any).x_mm ?? 0,
      y_mm: (payload as any).y_mm ?? 0,
      w_mm: (payload as any).w_mm ?? 800,
      h_mm: (payload as any).h_mm ?? 800,
      rotation_deg: (payload as any).rotation_deg ?? 0,
      z_index: (payload as any).z_index ?? 1,
      version: 1,
      created_at: now,
      updated_at: now,
    };

    mockTables.push(table);
    saveTables();
    await recordEvent({
      outlet_id: table.outlet_id,
      entity_type: "TABLE",
      entity_id: table.id,
      event_type: "TABLE_CREATED",
      to_state: "available",
    });
    return enrichTable(table);
  } finally {
    release();
  }
}

export async function updateTable(id: string, payload: TablePayload): Promise<TableWithDerived> {
  const release = await entityMutex.acquire(`table-${id}`);
  try {
    await delay(500);
    const idx = mockTables.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Table not found");

    const current = mockTables[idx];
    if (payload.outlet_id !== undefined && payload.outlet_id !== current.outlet_id) {
      throw new Error("Table cannot move across outlets");
    }
    const activeGroups = mockGroups.filter(
      (g) => g.table_id === id && (g.status === "SEATED" || g.status === "ORDERING"),
    );

    // H2: moving a seated table across floors orphans its groups — reject
    if (
      payload.floor_id !== undefined &&
      payload.floor_id !== current.floor_id &&
      activeGroups.length > 0
    ) {
      throw new Error("Cannot move table to another floor with active guests. Release or transfer groups first.");
    }

    // Safety guard on structural changes (H5: presence-checked, not truthiness-checked)
    if (activeGroups.length > 0) {
      const seated = activeGroups.reduce((s, g) => s + g.seats, 0);
      if (payload.capacity !== undefined && payload.capacity < seated) {
        throw new Error(`Cannot reduce capacity below current occupancy (${seated})`);
      }
      if (
        "allows_sharing" in payload &&
        (payload as any).allows_sharing === false &&
        activeGroups.length > 1
      ) {
        throw new Error("Cannot disable sharing with multiple active groups");
      }
    }

    const updated = {
      ...current,
      ...payload,
      number: payload.number?.toUpperCase() ?? current.number,
      code: payload.code?.toUpperCase() ?? current.code,
      updated_at: new Date().toISOString(),
      version: current.version + 1,
    } as any;
    
    mockTables[idx] = updated;
    saveTables();

    await recordEvent({
      outlet_id: current.outlet_id,
      entity_type: "TABLE",
      entity_id: id,
      event_type: "TABLE_UPDATED",
      metadata: { payload },
    });

    return enrichTable(mockTables[idx]);
  } finally {
    release();
  }
}

export async function deleteTable(id: string): Promise<void> {
  const release = await entityMutex.acquire(`table-${id}`);
  try {
    await delay(400);
    const idx = mockTables.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Table not found");

    const activeGroups = mockGroups.filter(
      (g) => g.table_id === id && (g.status === "SEATED" || g.status === "ORDERING"),
    );
    if (activeGroups.length > 0) {
      throw new Error("Cannot delete table with active guests");
    }

    mockTables[idx].deleted_at = new Date().toISOString();
    mockTables[idx].is_active = false;
    saveTables();

    await recordEvent({
      outlet_id: mockTables[idx].outlet_id,
      entity_type: "TABLE",
      entity_id: id,
      event_type: "TABLE_DELETED",
    });
  } finally {
    release();
  }
}

// Layout Commands — C3: single pose writer with lock, version bump, and audit.
// Callers must batch a drag into ONE setTablePose call per pointer-up.

export async function setTablePose(
  id: string,
  params: { x_mm?: number; y_mm?: number; w_mm?: number; h_mm?: number; rotation_deg?: number },
): Promise<void> {
  const release = await entityMutex.acquire(`table-${id}`);
  try {
    await delay(200);
    const idx = mockTables.findIndex(t => t.id === id && !t.deleted_at);
    if (idx === -1) return;
    const moved =
      (params.x_mm !== undefined && params.x_mm !== mockTables[idx].x_mm) ||
      (params.y_mm !== undefined && params.y_mm !== mockTables[idx].y_mm);
    const resized =
      (params.w_mm !== undefined && params.w_mm !== mockTables[idx].w_mm) ||
      (params.h_mm !== undefined && params.h_mm !== mockTables[idx].h_mm);
    const rotated =
      params.rotation_deg !== undefined && params.rotation_deg !== mockTables[idx].rotation_deg;
    if (!moved && !resized && !rotated) return;
    mockTables[idx] = {
      ...mockTables[idx],
      ...(params.x_mm !== undefined ? { x_mm: params.x_mm } : {}),
      ...(params.y_mm !== undefined ? { y_mm: params.y_mm } : {}),
      ...(params.w_mm !== undefined ? { w_mm: params.w_mm } : {}),
      ...(params.h_mm !== undefined ? { h_mm: params.h_mm } : {}),
      ...(params.rotation_deg !== undefined ? { rotation_deg: params.rotation_deg } : {}),
      updated_at: new Date().toISOString(),
      version: mockTables[idx].version + 1,
    };
    saveTables();
    await recordEvent({
      outlet_id: mockTables[idx].outlet_id,
      entity_type: "TABLE",
      entity_id: id,
      event_type: resized ? "TABLE_RESIZED" : "TABLE_MOVED",
      metadata: { ...params },
    });
  } finally {
    release();
  }
}

export async function moveTable(id: string, params: { x_mm: number; y_mm: number }): Promise<void> {
  return setTablePose(id, params);
}

export async function resizeTable(id: string, params: { w_mm: number; h_mm: number }): Promise<void> {
  return setTablePose(id, params);
}

export async function rotateTable(id: string, params: { rotation_deg: number }): Promise<void> {
  return setTablePose(id, params);
}

// Occupancy Commands (Transactional - Design ruling C4)

export async function seatOccupancy(params: {
  table_id: string;
  seats: number;
  created_by?: string;
  hold_id?: string;
  force?: boolean;
  reason?: string;
  group_id?: string;
  ctx?: Partial<CommandContext>;
}): Promise<OccupancyGroup> {
  const ctx = ctxOf(params.ctx);
  // Idempotent replay: client-generated group id already seated
  if (params.group_id) {
    const existing = mockGroups.find((g) => g.id === params.group_id);
    if (existing) return { ...existing };
  }
  const release = await entityMutex.acquire(`table-${params.table_id}`);
  try {
    await delay(400);
    const table = mockTables.find((t) => t.id === params.table_id && !t.deleted_at);
    if (!table) throw new Error("Table not found");
    assertOutlet(table.outlet_id, ctx, "Table");
    if (params.seats < 1 || !Number.isInteger(params.seats)) {
      throw new Error("Seats must be a positive integer");
    }
    if (table.status === "out_of_service") throw new Error("Table is out of service");
    if (table.status === "cleaning") {
      throw new Error("Table is being cleaned. Mark it cleaned first.");
    }
    const liveBlock = mockBlocks.find((b) => b.table_id === table.id && !b.released_at);
    if (liveBlock && !params.force) {
      throw new Error(`Table is blocked (${liveBlock.reason}). Unblock it first or force with a reason.`);
    }

    const activeGroups = mockGroups.filter(
      (g) => g.table_id === params.table_id && (g.status === "SEATED" || g.status === "ORDERING"),
    );

    if (!table.allows_sharing && activeGroups.length > 0) {
      throw new Error("Table does not allow sharing");
    }

    const currentSeated = activeGroups.reduce((s, g) => s + g.seats, 0);
    if (currentSeated + params.seats > table.capacity) {
      throw new Error(`Insufficient capacity. Only ${table.capacity - currentSeated} seats available.`);
    }

    // Hold consume-by-identity: explicit hold_id wins; otherwise exactly one live
    // HELD hold may be consumed; zero or ambiguous holds consume nothing.
    let consumedHoldId: string | undefined;
    if (params.hold_id) {
      const hold = mockHolds.find((h) => h.id === params.hold_id);
      if (!hold || hold.table_id !== table.id || hold.status !== "HELD") {
        throw new Error("Reservation hold is not available for seating");
      }
      const nowHold = new Date().toISOString();
      if (nowHold < hold.hold_from || nowHold > hold.hold_until) {
        throw new Error("Reservation hold is outside its time window");
      }
      hold.status = "SEATED";
      consumedHoldId = hold.id;
    } else {
      const liveHolds = mockHolds.filter((h) => h.table_id === table.id && h.status === "HELD");
      if (liveHolds.length === 1) {
        liveHolds[0].status = "SEATED";
        consumedHoldId = liveHolds[0].id;
      }
    }

    const now = new Date().toISOString();
    const group: OccupancyGroup = {
      id: params.group_id ?? `occ_${Date.now().toString(36)}`,
      table_id: params.table_id,
      outlet_id: table.outlet_id,
      floor_id: table.floor_id,
      seats: params.seats,
      order_id: null,
      status: "SEATED",
      seated_at: now,
      floor_name_snapshot: table.floor_name,
      table_number_snapshot: table.number,
      table_code_snapshot: table.code,
      capacity_at_seating: table.capacity,
      created_by: params.created_by ?? ctx.actor_id,
      created_at: now,
      updated_at: now,
      version: 1,
    };

    mockGroups.push(group);

    // Side effect: update table status
    const tableIdx = mockTables.findIndex((t) => t.id === params.table_id);
    if (tableIdx !== -1) {
      const oldStatus = mockTables[tableIdx].status;
      if (oldStatus === "available" || oldStatus === "reserved") {
        await transitionTable(tableIdx, "occupied", { actor_id: ctx.actor_id });
      }
    }
    saveTables();

    await recordEvent({
      outlet_id: group.outlet_id,
      entity_type: "OCCUPANCY_GROUP",
      entity_id: group.id,
      event_type: "OCCUPANCY_SEATED",
      to_state: "SEATED",
      actor_id: ctx.actor_id,
      reason_text: params.force ? params.reason : undefined,
      metadata: { table_id: table.id, seats: params.seats, hold_id: consumedHoldId },
    });

    return { ...group };
  } finally {
    release();
  }
}

export async function releaseOccupancy(params: {
  group_id: string;
  released_by?: string;
  reason: string;
  force?: boolean;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  // C2: resolve the table first (for lock key), but re-read the group INSIDE the lock
  const probe = mockGroups.find((g) => g.id === params.group_id);
  if (!probe) throw new Error("Group not found");

  const release = await entityMutex.acquire(`table-${probe.table_id}`);
  try {
    await delay(400);
    const idx = mockGroups.findIndex((g) => g.id === params.group_id);
    if (idx === -1) throw new Error("Group not found");
    const group = mockGroups[idx];
    if (group.status === "RELEASED" || group.status === "CANCELLED") return;
    const ctx = ctxOf({ ...params.ctx, actor_id: params.released_by ?? params.ctx?.actor_id });
    assertOutlet(group.outlet_id, ctx, "Occupancy group");

    // Unpaid-order guard: normal release requires no open order pointer.
    // Force path records who/why explicitly (OCCUPANCY_FORCE_RELEASED).
    const forced = !!params.force;
    if (group.order_id && !forced) {
      throw new Error(
        "Group has an open order. Settle, transfer, or cancel it first — or force-release with a reason.",
      );
    }

    const now = new Date().toISOString();
    mockGroups[idx] = {
      ...group,
      status: "RELEASED",
      released_at: now,
      released_by: ctx.actor_id,
      release_reason: params.reason,
      force_released: forced || undefined,
      updated_at: now,
      version: group.version + 1,
    };

    // Side effect: Transition table to CLEANING if last group (Design Ruling C6)
    const activeOnTable = mockGroups.filter(g =>
      g.table_id === group.table_id &&
      g.id !== group.id &&
      (g.status === "SEATED" || g.status === "ORDERING")
    );

    if (activeOnTable.length === 0) {
      const tableIdx = mockTables.findIndex(t => t.id === group.table_id);
      if (tableIdx !== -1 && mockTables[tableIdx].status === "occupied") {
        await transitionTable(tableIdx, "cleaning", {
          actor_id: params.released_by,
          event_type: "TABLE_CLEANING_STARTED",
        });
      }
    }

    saveTables();

    await recordEvent({
      outlet_id: group.outlet_id,
      entity_type: "OCCUPANCY_GROUP",
      entity_id: group.id,
      event_type: forced ? "OCCUPANCY_FORCE_RELEASED" : "OCCUPANCY_RELEASED",
      from_state: group.status,
      to_state: "RELEASED",
      actor_id: ctx.actor_id,
      reason_text: params.reason,
      metadata: forced ? { order_id: group.order_id } : undefined,
    });
  } finally {
    release();
  }
}

export async function forceReleaseOccupancy(params: {
  group_id: string;
  released_by?: string;
  reason: string;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  if (!params.reason?.trim()) throw new Error("A reason is required for force release");
  return releaseOccupancy({ ...params, force: true });
}

export async function addGuests(params: {
  group_id: string;
  extra_seats: number;
  ctx?: Partial<CommandContext>;
}): Promise<OccupancyGroup> {
  const probe = mockGroups.find((g) => g.id === params.group_id);
  if (!probe) throw new Error("Group not found");
  const release = await entityMutex.acquire(`table-${probe.table_id}`);
  try {
    await delay(300);
    const idx = mockGroups.findIndex((g) => g.id === params.group_id);
    const group = mockGroups[idx];
    if (group.status !== "SEATED" && group.status !== "ORDERING") {
      throw new Error("Can only add guests to an active group");
    }
    const ctx = ctxOf(params.ctx);
    assertOutlet(group.outlet_id, ctx, "Occupancy group");
    if (!Number.isInteger(params.extra_seats) || params.extra_seats < 1) {
      throw new Error("Extra seats must be a positive integer");
    }
    const table = mockTables.find((t) => t.id === group.table_id && !t.deleted_at);
    if (!table) throw new Error("Table not found");
    const seatedOthers = mockGroups
      .filter((g) => g.table_id === group.table_id && g.id !== group.id && (g.status === "SEATED" || g.status === "ORDERING"))
      .reduce((s, g) => s + g.seats, 0);
    if (seatedOthers + group.seats + params.extra_seats > table.capacity) {
      throw new Error(
        `Insufficient capacity. Only ${table.capacity - seatedOthers - group.seats} seats available.`,
      );
    }
    const now = new Date().toISOString();
    mockGroups[idx] = {
      ...group,
      seats: group.seats + params.extra_seats,
      updated_at: now,
      version: group.version + 1,
    };
    saveTables();
    await recordEvent({
      outlet_id: group.outlet_id,
      entity_type: "OCCUPANCY_GROUP",
      entity_id: group.id,
      event_type: "OCCUPANCY_GUESTS_ADDED",
      actor_id: ctx.actor_id,
      metadata: { extra_seats: params.extra_seats, total_seats: group.seats + params.extra_seats },
    });
    return { ...mockGroups[idx] };
  } finally {
    release();
  }
}

export async function attachOrder(params: {
  group_id: string;
  order_id: string;
  ctx?: Partial<CommandContext>;
}): Promise<OccupancyGroup> {
  const probe = mockGroups.find((g) => g.id === params.group_id);
  if (!probe) throw new Error("Group not found");
  const release = await entityMutex.acquire(`table-${probe.table_id}`);
  try {
    await delay(300);
    const idx = mockGroups.findIndex((g) => g.id === params.group_id);
    const group = mockGroups[idx];
    if (group.status !== "SEATED") throw new Error("Order can only attach to a SEATED group");
    if (group.order_id) throw new Error("Group already has an order attached");
    if (!params.order_id?.trim()) throw new Error("order_id is required");
    const ctx = ctxOf(params.ctx);
    assertOutlet(group.outlet_id, ctx, "Occupancy group");
    const now = new Date().toISOString();
    mockGroups[idx] = {
      ...group,
      order_id: params.order_id,
      status: "ORDERING",
      updated_at: now,
      version: group.version + 1,
    };
    saveTables();
    await recordEvent({
      outlet_id: group.outlet_id,
      entity_type: "OCCUPANCY_GROUP",
      entity_id: group.id,
      event_type: "OCCUPANCY_ORDER_ATTACHED",
      from_state: "SEATED",
      to_state: "ORDERING",
      actor_id: ctx.actor_id,
      metadata: { order_id: params.order_id },
    });
    return { ...mockGroups[idx] };
  } finally {
    release();
  }
}

export async function cancelOccupancy(params: {
  group_id: string;
  by?: string;
  reason: string;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  const probe = mockGroups.find((g) => g.id === params.group_id);
  if (!probe) throw new Error("Group not found");
  const release = await entityMutex.acquire(`table-${probe.table_id}`);
  try {
    await delay(300);
    const idx = mockGroups.findIndex((g) => g.id === params.group_id);
    const group = mockGroups[idx];
    if (group.status === "RELEASED" || group.status === "CANCELLED") return;
    const ctx = ctxOf({ ...params.ctx, actor_id: params.by ?? params.ctx?.actor_id });
    assertOutlet(group.outlet_id, ctx, "Occupancy group");
    if (group.order_id) {
      throw new Error("Group has an order. Cancel it through the orders module first.");
    }
    if (!params.reason?.trim()) throw new Error("A reason is required to cancel occupancy");
    const now = new Date().toISOString();
    mockGroups[idx] = {
      ...group,
      status: "CANCELLED",
      released_at: now,
      released_by: ctx.actor_id,
      release_reason: params.reason,
      updated_at: now,
      version: group.version + 1,
    };
    saveTables();
    await recordEvent({
      outlet_id: group.outlet_id,
      entity_type: "OCCUPANCY_GROUP",
      entity_id: group.id,
      event_type: "OCCUPANCY_CANCELLED",
      from_state: group.status,
      to_state: "CANCELLED",
      actor_id: ctx.actor_id,
      reason_text: params.reason,
    });
  } finally {
    release();
  }
}

export async function transferOccupancy(params: {
  group_ids: string[];
  to_table_id: string;
  moved_by?: string;
  reason: string;
  ctx?: Partial<CommandContext>;
}): Promise<OccupancyGroup[]> {
  if (!params.group_ids.length) throw new Error("At least one group is required");
  if (!params.reason?.trim()) throw new Error("A reason is required for transfer");
  const groups = params.group_ids.map((id) => {
    const g = mockGroups.find((x) => x.id === id);
    if (!g) throw new Error(`Group not found: ${id}`);
    return g;
  });
  // Lock ordering by id to avoid deadlock; validate everything before mutating.
  const tableIds = [...new Set([...groups.map((g) => g.table_id), params.to_table_id])].sort();
  const releases = await Promise.all(tableIds.map((id) => entityMutex.acquire(`table-${id}`)));
  const releaseAll = () => releases.forEach((r) => r());
  try {
    await delay(400);
    const ctx = ctxOf({ ...params.ctx, actor_id: params.moved_by ?? params.ctx?.actor_id });
    const dest = mockTables.find((t) => t.id === params.to_table_id && !t.deleted_at);
    if (!dest) throw new Error("Destination table not found");
    assertOutlet(dest.outlet_id, ctx, "Destination table");
    if (dest.status === "out_of_service" || dest.status === "cleaning") {
      throw new Error(`Destination table is ${dest.status.replace("_", " ")}`);
    }
    const liveBlock = mockBlocks.find((b) => b.table_id === dest.id && !b.released_at);
    if (liveBlock) throw new Error(`Destination table is blocked (${liveBlock.reason})`);
    for (const g of groups) {
      assertOutlet(g.outlet_id, ctx, "Occupancy group");
      if (g.status !== "SEATED" && g.status !== "ORDERING") {
        throw new Error(`Group ${g.id} is not active`);
      }
      if (g.table_id === dest.id) throw new Error("Group is already on the destination table");
    }
    const movingSeats = groups.reduce((s, g) => s + g.seats, 0);
    const destSeated = mockGroups
      .filter(
        (g) =>
          g.table_id === dest.id &&
          !groups.some((m) => m.id === g.id) &&
          (g.status === "SEATED" || g.status === "ORDERING"),
      )
      .reduce((s, g) => s + g.seats, 0);
    if (destSeated + movingSeats > dest.capacity) {
      throw new Error(
        `Destination table has only ${dest.capacity - destSeated} seats available.`,
      );
    }
    const destActiveCount = mockGroups.filter(
      (g) =>
        g.table_id === dest.id &&
        !groups.some((m) => m.id === g.id) &&
        (g.status === "SEATED" || g.status === "ORDERING"),
    ).length;
    if (!dest.allows_sharing && destActiveCount + groups.length > 1) {
      throw new Error("Destination table does not allow sharing");
    }
    // Forbid merging groups that carry different orders (split belongs to orders module).
    const orderIds = [...new Set(groups.map((g) => g.order_id).filter(Boolean))];
    if (orderIds.length > 1) {
      throw new Error("Cannot merge groups with different orders. Split or settle them first.");
    }
    const now = new Date().toISOString();
    const moved = groups.map((g) => {
      const idx = mockGroups.findIndex((x) => x.id === g.id);
      mockGroups[idx] = {
        ...g,
        table_id: dest.id,
        floor_id: dest.floor_id,
        updated_at: now,
        version: g.version + 1,
      };
      return { ...mockGroups[idx] };
    });
    saveTables();
    for (const g of groups) {
      await recordEvent({
        outlet_id: dest.outlet_id,
        entity_type: "OCCUPANCY_GROUP",
        entity_id: g.id,
        event_type: "OCCUPANCY_TRANSFERRED",
        actor_id: ctx.actor_id,
        reason_text: params.reason,
        metadata: { from_table_id: g.table_id, to_table_id: dest.id },
      });
    }
    // Recompute source table statuses (a vacated table goes to cleaning)
    for (const srcId of [...new Set(groups.map((g) => g.table_id))]) {
      const stillActive = mockGroups.some(
        (g) => g.table_id === srcId && (g.status === "SEATED" || g.status === "ORDERING"),
      );
      const sIdx = mockTables.findIndex((t) => t.id === srcId);
      if (!stillActive && sIdx !== -1 && mockTables[sIdx].status === "occupied") {
        await transitionTable(sIdx, "cleaning", { actor_id: ctx.actor_id });
      }
    }
    const dIdx = mockTables.findIndex((t) => t.id === dest.id);
    if (dIdx !== -1 && (mockTables[dIdx].status === "available" || mockTables[dIdx].status === "reserved")) {
      await transitionTable(dIdx, "occupied", { actor_id: ctx.actor_id });
    }
    saveTables();
    return moved;
  } finally {
    releaseAll();
  }
}

export async function markCleaned(params: {
  table_id: string;
  by?: string;
  ctx?: Partial<CommandContext>;
}): Promise<TableWithDerived> {
  const release = await entityMutex.acquire(`table-${params.table_id}`);
  try {
    await delay(300);
    const idx = mockTables.findIndex((t) => t.id === params.table_id && !t.deleted_at);
    if (idx === -1) throw new Error("Table not found");
    const ctx = ctxOf({ ...params.ctx, actor_id: params.by ?? params.ctx?.actor_id });
    assertOutlet(mockTables[idx].outlet_id, ctx, "Table");
    await transitionTable(idx, "available", {
      actor_id: ctx.actor_id,
      event_type: "TABLE_CLEANING_COMPLETED",
    });
    saveTables();
    return enrichTable(mockTables[idx]);
  } finally {
    release();
  }
}

export async function blockTable(params: {
  table_id: string;
  reason: string;
  by?: string;
  until_at?: string;
  ctx?: Partial<CommandContext>;
}): Promise<TableBlock> {
  const release = await entityMutex.acquire(`table-${params.table_id}`);
  try {
    await delay(300);
    const table = mockTables.find((t) => t.id === params.table_id && !t.deleted_at);
    if (!table) throw new Error("Table not found");
    const ctx = ctxOf({ ...params.ctx, actor_id: params.by ?? params.ctx?.actor_id });
    assertOutlet(table.outlet_id, ctx, "Table");
    if (!params.reason?.trim()) throw new Error("A reason is required to block a table");
    if (mockBlocks.some((b) => b.table_id === table.id && !b.released_at)) {
      throw new Error("Table is already blocked");
    }
    const now = new Date().toISOString();
    const block: TableBlock = {
      id: `blk_${Date.now().toString(36)}`,
      table_id: table.id,
      outlet_id: table.outlet_id,
      reason: params.reason,
      blocked_at: now,
      blocked_by: ctx.actor_id,
      until_at: params.until_at,
      created_at: now,
    };
    mockBlocks.push(block);
    saveTables();
    await recordEvent({
      outlet_id: table.outlet_id,
      entity_type: "TABLE",
      entity_id: table.id,
      event_type: "TABLE_BLOCKED",
      actor_id: ctx.actor_id,
      reason_text: params.reason,
    });
    return { ...block };
  } finally {
    release();
  }
}

export async function unblockTable(params: {
  table_id: string;
  by?: string;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  const release = await entityMutex.acquire(`table-${params.table_id}`);
  try {
    await delay(300);
    const table = mockTables.find((t) => t.id === params.table_id && !t.deleted_at);
    if (!table) throw new Error("Table not found");
    const ctx = ctxOf({ ...params.ctx, actor_id: params.by ?? params.ctx?.actor_id });
    assertOutlet(table.outlet_id, ctx, "Table");
    const block = mockBlocks.find((b) => b.table_id === table.id && !b.released_at);
    if (!block) return;
    block.released_at = new Date().toISOString();
    block.released_by = ctx.actor_id;
    saveTables();
    await recordEvent({
      outlet_id: table.outlet_id,
      entity_type: "TABLE",
      entity_id: table.id,
      event_type: "TABLE_UNBLOCKED",
      actor_id: ctx.actor_id,
    });
  } finally {
    release();
  }
}

export async function createHold(params: {
  table_id: string;
  holder_name: string;
  holder_phone?: string;
  party_size: number;
  hold_from: string;
  hold_until: string;
  by?: string;
  ctx?: Partial<CommandContext>;
}): Promise<ReservationHold> {
  const release = await entityMutex.acquire(`table-${params.table_id}`);
  try {
    await delay(300);
    const table = mockTables.find((t) => t.id === params.table_id && !t.deleted_at);
    if (!table) throw new Error("Table not found");
    const ctx = ctxOf({ ...params.ctx, actor_id: params.by ?? params.ctx?.actor_id });
    assertOutlet(table.outlet_id, ctx, "Table");
    if (!params.holder_name?.trim()) throw new Error("Holder name is required");
    if (!Number.isInteger(params.party_size) || params.party_size < 1) {
      throw new Error("Party size must be a positive integer");
    }
    if (params.party_size > table.capacity) {
      throw new Error("Party size exceeds table capacity");
    }
    if (params.hold_from >= params.hold_until) {
      throw new Error("Hold window is invalid");
    }
    if (table.status === "out_of_service") throw new Error("Table is out of service");
    if (mockBlocks.some((b) => b.table_id === table.id && !b.released_at)) {
      throw new Error("Table is blocked");
    }
    const overlap = mockHolds.some(
      (h) =>
        h.table_id === table.id &&
        h.status === "HELD" &&
        params.hold_from < h.hold_until &&
        h.hold_from < params.hold_until,
    );
    if (overlap) throw new Error("An overlapping hold already exists on this table");
    const now = new Date().toISOString();
    const hold: ReservationHold = {
      id: `rsv_${Date.now().toString(36)}`,
      table_id: table.id,
      outlet_id: table.outlet_id,
      holder_name: params.holder_name,
      holder_phone: params.holder_phone,
      party_size: params.party_size,
      hold_from: params.hold_from,
      hold_until: params.hold_until,
      status: "HELD",
      created_by: ctx.actor_id,
      created_at: now,
      version: 1,
    };
    mockHolds.push(hold);
    saveTables();
    await recordEvent({
      outlet_id: table.outlet_id,
      entity_type: "RESERVATION",
      entity_id: hold.id,
      event_type: "OCCUPANCY_SEATED",
      actor_id: ctx.actor_id,
      reason_code: "HOLD_CREATED",
      metadata: { table_id: table.id, party_size: params.party_size },
    });
    return { ...hold };
  } finally {
    release();
  }
}

export async function cancelHold(params: {
  hold_id: string;
  by?: string;
  reason?: string;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  const hold = mockHolds.find((h) => h.id === params.hold_id);
  if (!hold) throw new Error("Hold not found");
  const release = await entityMutex.acquire(`table-${hold.table_id}`);
  try {
    await delay(200);
    const idx = mockHolds.findIndex((h) => h.id === params.hold_id);
    const h = mockHolds[idx];
    if (h.status !== "HELD") return;
    const ctx = ctxOf({ ...params.ctx, actor_id: params.by ?? params.ctx?.actor_id });
    assertOutlet(h.outlet_id, ctx, "Reservation hold");
    mockHolds[idx] = {
      ...h,
      status: "CANCELLED",
      cancelled_by: ctx.actor_id,
      cancelled_at: new Date().toISOString(),
      version: h.version + 1,
    };
    saveTables();
    await recordEvent({
      outlet_id: h.outlet_id,
      entity_type: "RESERVATION",
      entity_id: h.id,
      event_type: "OCCUPANCY_CANCELLED",
      actor_id: ctx.actor_id,
      reason_code: "HOLD_CANCELLED",
      reason_text: params.reason,
    });
  } finally {
    release();
  }
}

export async function expireHold(params: { hold_id: string }): Promise<void> {
  const hold = mockHolds.find((h) => h.id === params.hold_id);
  if (!hold || hold.status !== "HELD") return;
  const release = await entityMutex.acquire(`table-${hold.table_id}`);
  try {
    await delay(200);
    const idx = mockHolds.findIndex((h) => h.id === params.hold_id);
    if (mockHolds[idx].status !== "HELD") return;
    mockHolds[idx] = { ...mockHolds[idx], status: "EXPIRED", version: mockHolds[idx].version + 1 };
    saveTables();
    await recordEvent({
      outlet_id: hold.outlet_id,
      entity_type: "RESERVATION",
      entity_id: hold.id,
      event_type: "OCCUPANCY_CANCELLED",
      reason_code: "HOLD_EXPIRED",
    });
  } finally {
    release();
  }
}
