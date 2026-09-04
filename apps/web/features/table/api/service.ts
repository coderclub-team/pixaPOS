import { delay } from "@/constants/mock-api";
import type { RestaurantTable, TableFilters, TablePayload } from "./types";

let mockTables: RestaurantTable[] = [
  {
    id: "tbl_001",
    outlet_id: "out_001",
    floor_id: "fl_001",
    floor_name: "Ground Floor",
    number: "T1",
    code: "T-GF-01",
    capacity: 4,
    shape: "square",
    status: "available",
    is_active: true,
    sort_order: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "tbl_002",
    outlet_id: "out_001",
    floor_id: "fl_001",
    floor_name: "Ground Floor",
    number: "T2",
    code: "T-GF-02",
    capacity: 2,
    shape: "round",
    status: "occupied",
    is_active: true,
    sort_order: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "tbl_003",
    outlet_id: "out_001",
    floor_id: "fl_002",
    floor_name: "First Floor",
    number: "T1",
    code: "T-FF-01",
    capacity: 6,
    shape: "rectangle",
    status: "reserved",
    is_active: true,
    sort_order: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "tbl_004",
    outlet_id: "out_001",
    floor_id: "fl_003",
    floor_name: "Rooftop",
    number: "T1",
    code: "T-RT-01",
    capacity: 4,
    shape: "round",
    status: "available",
    is_active: true,
    sort_order: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "tbl_005",
    outlet_id: "out_001",
    floor_id: "fl_003",
    floor_name: "Rooftop",
    number: "T2",
    code: "T-RT-02",
    capacity: 2,
    shape: "square",
    status: "maintenance",
    is_active: false,
    sort_order: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const floorNameMap: Record<string, string> = {
  fl_001: "Ground Floor",
  fl_002: "First Floor",
  fl_003: "Rooftop",
  fl_004: "Basement",
};

function sortedTables(): RestaurantTable[] {
  return [...mockTables].sort(
    (a, b) => a.sort_order - b.sort_order || a.number.localeCompare(b.number),
  );
}

export async function getTables(filters?: TableFilters): Promise<RestaurantTable[]> {
  await delay(400);
  let result = sortedTables();
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (t) => t.number.toLowerCase().includes(q) || t.code.toLowerCase().includes(q),
    );
  }
  if (filters?.floor_id) {
    result = result.filter((t) => t.floor_id === filters.floor_id);
  }
  if (filters?.status) {
    result = result.filter((t) => t.status === filters.status);
  }
  if (filters?.is_active !== undefined) {
    result = result.filter((t) => t.is_active === filters.is_active);
  }
  return result;
}

export async function getTableById(id: string): Promise<RestaurantTable | null> {
  await delay(300);
  return mockTables.find((t) => t.id === id) ?? null;
}

export async function createTable(payload: TablePayload): Promise<RestaurantTable> {
  await delay(600);
  if (mockTables.some((t) => t.code.toLowerCase() === payload.code.toLowerCase())) {
    throw new Error(`Table code "${payload.code}" already exists`);
  }
  // unique number per floor
  if (
    mockTables.some(
      (t) =>
        t.floor_id === payload.floor_id && t.number.toLowerCase() === payload.number.toLowerCase(),
    )
  ) {
    throw new Error(`Table number "${payload.number}" already exists on this floor`);
  }
  const now = new Date().toISOString();
  const table: RestaurantTable = {
    id: `tbl_${Date.now().toString(36)}`,
    outlet_id: "out_001",
    floor_id: payload.floor_id,
    floor_name: floorNameMap[payload.floor_id] ?? payload.floor_id,
    number: payload.number.toUpperCase(),
    code: payload.code.toUpperCase(),
    capacity: payload.capacity,
    shape: payload.shape ?? "square",
    status: payload.status ?? "available",
    is_active: payload.is_active ?? true,
    sort_order:
      payload.sort_order ?? mockTables.filter((t) => t.floor_id === payload.floor_id).length,
    created_at: now,
    updated_at: now,
  };
  mockTables.push(table);
  return { ...table };
}

export async function updateTable(id: string, payload: TablePayload): Promise<RestaurantTable> {
  await delay(600);
  const idx = mockTables.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Table not found");
  if (
    payload.code &&
    mockTables.some((t) => t.id !== id && t.code.toLowerCase() === payload.code!.toLowerCase())
  ) {
    throw new Error(`Table code "${payload.code}" already exists`);
  }
  if (
    payload.number &&
    payload.floor_id &&
    mockTables.some(
      (t) =>
        t.id !== id &&
        t.floor_id === payload.floor_id &&
        t.number.toLowerCase() === payload.number!.toLowerCase(),
    )
  ) {
    throw new Error(`Table number "${payload.number}" already exists on this floor`);
  }
  const current = mockTables[idx];
  const nextFloorId = payload.floor_id ?? current.floor_id;
  const updated: RestaurantTable = {
    ...current,
    ...payload,
    number: payload.number ? payload.number.toUpperCase() : current.number,
    code: payload.code ? payload.code.toUpperCase() : current.code,
    floor_name: floorNameMap[nextFloorId] ?? nextFloorId,
    updated_at: new Date().toISOString(),
  };
  mockTables[idx] = updated;
  return { ...updated };
}

export async function deleteTable(id: string): Promise<void> {
  await delay(500);
  const idx = mockTables.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Table not found");
  mockTables.splice(idx, 1);
}
