import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { entityMutex } from "@/lib/mutex";
import type {
  Floor,
  FloorFilters,
  FloorPayload,
  FloorLayout,
  ReorderFloorInput,
} from "./types";
import {
  RestaurantTable,
  TableWithDerived,
  OccupancyGroup,
  TableBlock,
  ReservationHold,
} from "@/features/table/api/types";
import { deriveTableInfo } from "@/features/table/api/utils";

// In-memory stores
let mockFloors: Floor[] = [
  {
    id: "fl_001",
    outlet_id: "out_001",
    name: "Ground Floor",
    code: "GF",
    description: "Main dining area",
    level: 0,
    capacity: 50,
    sort_order: 1,
    is_active: true,
    is_outdoor: false,
    width_mm: 12000,
    height_mm: 8000,
    grid_size_mm: 100,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

import {
  mockTables,
  mockGroups,
  mockBlocks,
  mockHolds,
} from "@/features/table/api/service";

// Persist mock floors to localStorage so created floors survive dev-server
// restarts (same PO_STORAGE_KEY pattern as inventory service).
const FLOOR_STORAGE_KEY = "pixaFloors";
function saveFloors() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(FLOOR_STORAGE_KEY, JSON.stringify(mockFloors));
    } catch {}
  }
}
function loadFloors(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(FLOOR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          mockFloors = parsed;
        }
      }
    } catch {}
  }
}
// hydrate from storage on browser init
loadFloors();

export async function getFloors(filters?: FloorFilters): Promise<Floor[]> {
  await delay(300);
  let r = [...mockFloors].filter((f) => !f.deleted_at);
  if (filters?.outlet_id) r = r.filter((f) => f.outlet_id === filters.outlet_id);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    r = r.filter((f) => f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q));
  }
  if (filters?.is_active !== undefined) r = r.filter((f) => f.is_active === filters.is_active);
  return r.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getFloorById(id: string): Promise<Floor | null> {
  await delay(200);
  return mockFloors.find((f) => f.id === id && !f.deleted_at) ?? null;
}

export async function getFloorLayout(floorId: string): Promise<FloorLayout> {
  await delay(400);
  const floor = mockFloors.find((f) => f.id === floorId && !f.deleted_at);
  if (!floor) throw new Error("Floor not found");

  const tables = mockTables.filter((t) => t.floor_id === floorId && !t.deleted_at);
  const groups = mockGroups.filter((g) => g.floor_id === floorId && (g.status === "SEATED" || g.status === "ORDERING"));

  const tablesWithDerived: TableWithDerived[] = tables.map((t) => {
    const activeGroups = groups.filter((g) => g.table_id === t.id);
    const activeBlock = mockBlocks.find((b) => b.table_id === t.id && !b.released_at);
    const activeHold = mockHolds.find((h) => h.table_id === t.id && h.status === "HELD");
    const info = deriveTableInfo(t, activeGroups, activeBlock, activeHold);

    return {
      ...t,
      occupancy_fill: info.occupancyFill,
      seated_seats: info.seatedSeats,
      active_groups: activeGroups,
      active_block: activeBlock,
      active_hold: activeHold,
      revenue_paise: 0,
    };
  });

  return { floor, tables: tablesWithDerived, groups };
}

export async function createFloor(payload: FloorPayload): Promise<Floor> {
  const release = await entityMutex.acquire("floor-write");
  try {
    await delay(500);
    const now = new Date().toISOString();
    const floor: Floor = {
      id: `fl_${Date.now().toString(36)}`,
      outlet_id: payload.outlet_id ?? "out_001",
      name: payload.name,
      code: payload.code.toUpperCase(),
      description: payload.description,
      level: payload.level ?? 0,
      capacity: payload.capacity ?? 20,
      sort_order: payload.sort_order ?? mockFloors.length + 1,
      is_active: payload.is_active ?? true,
      is_outdoor: payload.is_outdoor ?? false,
      width_mm: payload.width_mm ?? 12000,
      height_mm: payload.height_mm ?? 8000,
      grid_size_mm: payload.grid_size_mm ?? 100,
      background_color: payload.background_color,
      background_image_url: payload.background_image_url,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    mockFloors.push(floor);
    saveFloors();
    await recordEvent({
      outlet_id: floor.outlet_id,
      entity_type: "FLOOR",
      entity_id: floor.id,
      event_type: "FLOOR_CREATED",
      to_state: "ACTIVE",
      metadata: { name: floor.name, code: floor.code },
    });
    return { ...floor };
  } finally {
    release();
  }
}

export async function updateFloor(id: string, payload: FloorPayload): Promise<Floor> {
  const release = await entityMutex.acquire(`floor-${id}`);
  try {
    await delay(500);
    const idx = mockFloors.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error("Floor not found");
    
    // Guard: if shrinking, ensure no tables orphaned (Design Edge Case E9)
    if (payload.width_mm || payload.height_mm) {
      const tables = mockTables.filter(t => t.floor_id === id && !t.deleted_at);
      const newW = payload.width_mm ?? mockFloors[idx].width_mm;
      const newH = payload.height_mm ?? mockFloors[idx].height_mm;
      const orphans = tables.filter(t => t.x_mm + t.w_mm > newW || t.y_mm + t.h_mm > newH);
      if (orphans.length > 0) {
        throw new Error(`Floor shrink would orphan ${orphans.length} tables. Move them first.`);
      }
    }

    const updated = {
      ...mockFloors[idx],
      ...payload,
      updated_at: new Date().toISOString(),
      version: mockFloors[idx].version + 1,
    };
    mockFloors[idx] = updated;
    saveFloors();
    await recordEvent({
      outlet_id: updated.outlet_id,
      entity_type: "FLOOR",
      entity_id: updated.id,
      event_type: "FLOOR_UPDATED",
      metadata: { payload },
    });
    return { ...updated };
  } finally {
    release();
  }
}

export async function reorderFloors(input: ReorderFloorInput[]): Promise<void> {
  const release = await entityMutex.acquire("floor-write");
  try {
    await delay(400);
    input.forEach(item => {
      const idx = mockFloors.findIndex(f => f.id === item.floor_id);
      if (idx !== -1) {
        mockFloors[idx].sort_order = item.sort_order;
        mockFloors[idx].updated_at = new Date().toISOString();
      }
    });
    saveFloors();
    await recordEvent({
      outlet_id: "out_001",
      entity_type: "FLOOR",
      entity_id: "global",
      event_type: "FLOOR_REORDERED",
    });
  } finally {
    release();
  }
}

export async function deleteFloor(id: string): Promise<void> {
  const release = await entityMutex.acquire(`floor-${id}`);
  try {
    await delay(400);
    const idx = mockFloors.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error("Floor not found");

    // Guard: active occupancy or tables (Debate M1)
    const tables = mockTables.filter(t => t.floor_id === id && !t.deleted_at);
    if (tables.length > 0) {
      throw new Error(`Cannot delete floor with ${tables.length} active tables.`);
    }

    mockFloors[idx].deleted_at = new Date().toISOString();
    mockFloors[idx].is_active = false;
    saveFloors();
    await recordEvent({
      outlet_id: mockFloors[idx].outlet_id,
      entity_type: "FLOOR",
      entity_id: id,
      event_type: "FLOOR_DELETED",
    });
  } finally {
    release();
  }
}
