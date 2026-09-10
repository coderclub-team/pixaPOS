import { delay } from "@/constants/mock-api";
import type { Floor, FloorFilters, FloorPayload, FloorLayout } from "./types";

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
  {
    id: "fl_002",
    outlet_id: "out_001",
    name: "First Floor",
    code: "F1",
    description: "Balcony and private booths",
    level: 1,
    capacity: 40,
    sort_order: 2,
    is_active: true,
    is_outdoor: false,
    width_mm: 10000,
    height_mm: 6000,
    grid_size_mm: 100,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function getFloors(filters?: FloorFilters): Promise<Floor[]> {
  await delay(300);
  let r = [...mockFloors].filter((f) => !f.deleted_at);
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

export async function createFloor(payload: FloorPayload): Promise<Floor> {
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
  return { ...floor };
}

export async function updateFloor(id: string, payload: FloorPayload): Promise<Floor> {
  await delay(500);
  const idx = mockFloors.findIndex((f) => f.id === id);
  if (idx === -1) throw new Error("Floor not found");
  mockFloors[idx] = {
    ...mockFloors[idx],
    ...payload,
    updated_at: new Date().toISOString(),
    version: mockFloors[idx].version + 1,
  };
  return { ...mockFloors[idx] };
}

export async function deleteFloor(id: string): Promise<void> {
  await delay(400);
  const idx = mockFloors.findIndex((f) => f.id === id);
  if (idx === -1) throw new Error("Floor not found");
  mockFloors[idx].deleted_at = new Date().toISOString();
  mockFloors[idx].is_active = false;
}
