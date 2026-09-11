import { delay } from "@/constants/mock-api";
import { recordEvent } from "@/features/events/api/service";
import { entityMutex } from "@/lib/mutex";
import type {
  Floor,
  FloorFilters,
  FloorPayload,
  FloorLayout,
  ReorderFloorInput,
  FloorObject,
  FloorObjectKind,
} from "./types";
import { getTablesWithDerivedByFloor } from "@/features/table/api/service";

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

// Persist mock floors to localStorage so created floors survive dev-server
// restarts (same PO_STORAGE_KEY pattern as inventory service).
const FLOOR_STORAGE_KEY = "pixaFloors";
function saveFloors() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(FLOOR_STORAGE_KEY, JSON.stringify({ floors: mockFloors, objects: mockObjects }));
    } catch {}
  }
}
function loadFloors(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(FLOOR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Back-compat: v1 stored a bare floors array
        const floors = Array.isArray(parsed) ? parsed : parsed?.floors;
        if (Array.isArray(floors) && floors.length > 0) {
          mockFloors = floors;
        }
        if (!Array.isArray(parsed) && Array.isArray(parsed?.objects)) {
          mockObjects = parsed.objects;
        }
      }
    } catch {}
  }
}

let mockObjects: FloorObject[] = [];
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

  // C4: compose through the table module's typed API — groups resolve
  // through their table's current floor (H2), never the seating snapshot.
  const { tables, groups } = await getTablesWithDerivedByFloor(floorId);
  const objects = mockObjects.filter((o) => o.floor_id === floorId && !o.deleted_at);
  return { floor, tables, groups, objects };
}

// Floor objects (walls / separators / decor / labels) — H4.
// Deliberately NOT tables: no capacity, occupancy, status machine, or code
// uniqueness. Owned by the floor module with their own CRUD + events.

export async function createFloorObject(payload: {
  floor_id: string;
  kind: FloorObjectKind;
  shapeVariant?: FloorObject["shapeVariant"];
  label?: string;
  x_mm?: number;
  y_mm?: number;
  w_mm?: number;
  h_mm?: number;
  rotation_deg?: number;
  color?: string;
}): Promise<FloorObject> {
  const release = await entityMutex.acquire(`floor-${payload.floor_id}`);
  try {
    await delay(300);
    const floor = mockFloors.find((f) => f.id === payload.floor_id && !f.deleted_at);
    if (!floor) throw new Error("Floor not found");
    const now = new Date().toISOString();
    const obj: FloorObject = {
      id: `fo_${Date.now().toString(36)}`,
      floor_id: payload.floor_id,
      outlet_id: floor.outlet_id,
      kind: payload.kind,
      shapeVariant: payload.shapeVariant,
      label: payload.label,
      x_mm: payload.x_mm ?? Math.round(floor.width_mm / 2 - 1000),
      y_mm: payload.y_mm ?? Math.round(floor.height_mm / 2),
      w_mm: payload.w_mm ?? 2000,
      h_mm: payload.h_mm ?? 150,
      rotation_deg: payload.rotation_deg ?? 0,
      z_index: 0,
      color: payload.color,
      created_at: now,
      updated_at: now,
      version: 1,
    };
    mockObjects.push(obj);
    saveFloors();
    await recordEvent({
      outlet_id: obj.outlet_id,
      entity_type: "FLOOR",
      entity_id: floor.id,
      event_type: "FLOOR_UPDATED",
      reason_code: "OBJECT_CREATED",
      metadata: { object_id: obj.id, kind: obj.kind },
    });
    return { ...obj };
  } finally {
    release();
  }
}

export async function moveFloorObject(
  id: string,
  params: { x_mm: number; y_mm: number },
): Promise<void> {
  return setFloorObjectPose(id, params);
}

export async function setFloorObjectPose(
  id: string,
  params: { x_mm?: number; y_mm?: number; w_mm?: number; h_mm?: number; rotation_deg?: number },
): Promise<void> {
  const idx = mockObjects.findIndex((o) => o.id === id && !o.deleted_at);
  if (idx === -1) return;
  const cur = mockObjects[idx];
  const next = {
    ...cur,
    ...(params.x_mm !== undefined ? { x_mm: params.x_mm } : {}),
    ...(params.y_mm !== undefined ? { y_mm: params.y_mm } : {}),
    ...(params.w_mm !== undefined ? { w_mm: params.w_mm } : {}),
    ...(params.h_mm !== undefined ? { h_mm: params.h_mm } : {}),
    ...(params.rotation_deg !== undefined ? { rotation_deg: params.rotation_deg } : {}),
    updated_at: new Date().toISOString(),
    version: cur.version + 1,
  };
  const changed =
    next.x_mm !== cur.x_mm ||
    next.y_mm !== cur.y_mm ||
    next.w_mm !== cur.w_mm ||
    next.h_mm !== cur.h_mm ||
    next.rotation_deg !== cur.rotation_deg;
  if (!changed) return;
  mockObjects[idx] = next;
  saveFloors();
  await recordEvent({
    outlet_id: cur.outlet_id,
    entity_type: "FLOOR",
    entity_id: cur.floor_id,
    event_type: "FLOOR_UPDATED",
    reason_code: "OBJECT_POSE",
    metadata: { object_id: id, ...params },
  });
}

export async function deleteFloorObject(id: string): Promise<void> {
  const obj = mockObjects.find((o) => o.id === id && !o.deleted_at);
  if (!obj) return;
  const release = await entityMutex.acquire(`floor-${obj.floor_id}`);
  try {
    await delay(200);
    const idx = mockObjects.findIndex((o) => o.id === id);
    if (idx === -1) return;
    mockObjects[idx] = {
      ...mockObjects[idx],
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveFloors();
    await recordEvent({
      outlet_id: obj.outlet_id,
      entity_type: "FLOOR",
      entity_id: obj.floor_id,
      event_type: "FLOOR_UPDATED",
      reason_code: "OBJECT_DELETED",
      metadata: { object_id: id, kind: obj.kind },
    });
  } finally {
    release();
  }
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
    if (payload.outlet_id !== undefined && payload.outlet_id !== mockFloors[idx].outlet_id) {
      throw new Error("Floor cannot move across outlets");
    }

    // Guard: if shrinking, ensure no tables or objects orphaned (Design Edge Case E9, M9)
    if (payload.width_mm || payload.height_mm) {
      const { tables } = await getTablesWithDerivedByFloor(id);
      const newW = payload.width_mm ?? mockFloors[idx].width_mm;
      const newH = payload.height_mm ?? mockFloors[idx].height_mm;
      const orphanTables = tables.filter(t => t.x_mm + t.w_mm > newW || t.y_mm + t.h_mm > newH);
      const orphanObjects = mockObjects.filter(
        o => o.floor_id === id && !o.deleted_at && (o.x_mm + o.w_mm > newW || o.y_mm + o.h_mm > newH),
      );
      const orphanNames = [
        ...orphanTables.map(t => t.number),
        ...orphanObjects.map(o => o.label ?? o.kind),
      ];
      if (orphanNames.length > 0) {
        throw new Error(
          `Floor shrink would orphan ${orphanNames.length} item(s) (${orphanNames.join(", ")}). Move them first.`,
        );
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
    const { tables, groups } = await getTablesWithDerivedByFloor(id);
    if (groups.length > 0) {
      throw new Error(
        `Cannot delete floor with ${groups.length} active occupancy group(s). Release them first.`,
      );
    }
    if (tables.length > 0) {
      throw new Error(`Cannot delete floor with ${tables.length} tables. Move or delete them first.`);
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
