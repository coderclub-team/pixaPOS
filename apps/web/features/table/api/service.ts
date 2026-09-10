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
} from "./types";
import { deriveTableInfo, canTransition } from "./utils";
import type { TableStatus } from "./types";

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
    revenue_paise: 0, 
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

export async function createTable(payload: TablePayload): Promise<TableWithDerived> {
  const release = await entityMutex.acquire("table-write");
  try {
    await delay(500);
    if (mockTables.some((t) => !t.deleted_at && t.code.toUpperCase() === payload.code.toUpperCase())) {
      throw new Error(`Table code "${payload.code}" already exists`);
    }

    const now = new Date().toISOString();
    const table: RestaurantTable = {
      id: `tbl_${Date.now().toString(36)}`,
      outlet_id: payload.outlet_id ?? "out_001",
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
  created_by: string;
}): Promise<OccupancyGroup> {
  const release = await entityMutex.acquire(`table-${params.table_id}`);
  try {
    await delay(400);
    const table = mockTables.find(t => t.id === params.table_id && !t.deleted_at);
    if (!table) throw new Error("Table not found");
    if (table.status === "out_of_service") throw new Error("Table is out of service");
    
    const activeGroups = mockGroups.filter(g => g.table_id === params.table_id && (g.status === "SEATED" || g.status === "ORDERING"));
    
    if (!table.allows_sharing && activeGroups.length > 0) {
      throw new Error("Table does not allow sharing");
    }

    const currentSeated = activeGroups.reduce((s, g) => s + g.seats, 0);
    if (currentSeated + params.seats > table.capacity) {
      throw new Error(`Insufficient capacity. Only ${table.capacity - currentSeated} seats available.`);
    }

    const now = new Date().toISOString();
    const group: OccupancyGroup = {
      id: `occ_${Date.now().toString(36)}`,
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
      created_by: params.created_by,
      created_at: now,
      updated_at: now,
      version: 1,
    };

    mockGroups.push(group);

    // M3: seating consumes matching reservation holds on this table
    mockHolds.forEach((h) => {
      if (h.table_id === params.table_id && h.status === "HELD") {
        h.status = "SEATED";
      }
    });

    // Side effect: update table status
    const tableIdx = mockTables.findIndex(t => t.id === params.table_id);
    if (tableIdx !== -1) {
      const oldStatus = mockTables[tableIdx].status;
      if (oldStatus === "available" || oldStatus === "reserved") {
        await transitionTable(tableIdx, "occupied", {});
      }
    }
    saveTables();

    await recordEvent({
      outlet_id: group.outlet_id,
      entity_type: "OCCUPANCY_GROUP",
      entity_id: group.id,
      event_type: "OCCUPANCY_SEATED",
      to_state: "SEATED",
      metadata: { table_id: table.id, seats: params.seats },
    });

    return { ...group };
  } finally {
    release();
  }
}

export async function releaseOccupancy(params: {
  group_id: string;
  released_by: string;
  reason: string;
}): Promise<void> {
  // C2: resolve the table first (for lock key), but re-read the group INSIDE the lock
  const probe = mockGroups.find(g => g.id === params.group_id);
  if (!probe) throw new Error("Group not found");

  const release = await entityMutex.acquire(`table-${probe.table_id}`);
  try {
    await delay(400);
    const idx = mockGroups.findIndex(g => g.id === params.group_id);
    if (idx === -1) throw new Error("Group not found");
    const group = mockGroups[idx];
    if (group.status === "RELEASED" || group.status === "CANCELLED") return;

    const now = new Date().toISOString();
    mockGroups[idx] = {
      ...group,
      status: "RELEASED",
      released_at: now,
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
      event_type: "OCCUPANCY_RELEASED",
      from_state: group.status,
      to_state: "RELEASED",
      actor_id: params.released_by,
      reason_text: params.reason,
    });
  } finally {
    release();
  }
}
