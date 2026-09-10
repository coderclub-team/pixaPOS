import { delay } from "@/constants/mock-api";
import type {
  RestaurantTable,
  TableFilters,
  TablePayload,
  OccupancyGroup,
  TableBlock,
  ReservationHold,
  TableWithDerived,
} from "./types";
import { deriveTableInfo } from "./utils";

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
  {
    id: "tbl_002",
    outlet_id: "out_001",
    floor_id: "fl_001",
    floor_name: "Ground Floor",
    number: "102",
    code: "T102",
    capacity: 2,
    shape: "round",
    type: "standard",
    allows_sharing: false,
    status: "occupied",
    is_active: true,
    sort_order: 2,
    x_mm: 2000,
    y_mm: 500,
    w_mm: 800,
    h_mm: 800,
    rotation_deg: 0,
    z_index: 1,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "tbl_003",
    outlet_id: "out_001",
    floor_id: "fl_001",
    floor_name: "Ground Floor",
    number: "BAR-1",
    code: "BAR01",
    capacity: 6,
    shape: "rectangle",
    type: "bar_counter",
    allows_sharing: true,
    status: "available",
    is_active: true,
    sort_order: 3,
    x_mm: 4000,
    y_mm: 2000,
    w_mm: 2000,
    h_mm: 600,
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

export async function createTable(payload: TablePayload): Promise<TableWithDerived> {
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
    status: (payload as any).status ?? "available",
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
  return enrichTable(table);
}

export async function updateTable(id: string, payload: TablePayload): Promise<TableWithDerived> {
  await delay(500);
  const idx = mockTables.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Table not found");

  const current = mockTables[idx];
  const activeGroups = mockGroups.filter(
    (g) => g.table_id === id && (g.status === "SEATED" || g.status === "ORDERING"),
  );
  if (activeGroups.length > 0 && (payload.capacity || (payload as any).allows_sharing)) {
    const seated = activeGroups.reduce((s, g) => s + g.seats, 0);
    if (payload.capacity && payload.capacity < seated) {
      throw new Error(`Cannot reduce capacity below current occupancy (${seated})`);
    }
  }

  mockTables[idx] = {
    ...current,
    ...payload,
    number: payload.number?.toUpperCase() ?? current.number,
    code: payload.code?.toUpperCase() ?? current.code,
    updated_at: new Date().toISOString(),
    version: current.version + 1,
  } as any;

  return enrichTable(mockTables[idx]);
}

export async function deleteTable(id: string): Promise<void> {
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
}
