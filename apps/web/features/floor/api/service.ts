import { delay } from "@/constants/mock-api";
import type { Floor, FloorFilters, FloorPayload } from "./types";

let mockFloors: Floor[] = [
  {
    id: "fl_001",
    outlet_id: "out_001",
    name: "Ground Floor",
    code: "FL-GF",
    description: "Main dining area, street level",
    level: 0,
    capacity: 80,
    sort_order: 0,
    is_active: true,
    is_outdoor: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "fl_002",
    outlet_id: "out_001",
    name: "First Floor",
    code: "FL-FF",
    description: "Upper level, family section",
    level: 1,
    capacity: 60,
    sort_order: 1,
    is_active: true,
    is_outdoor: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
  },
  {
    id: "fl_003",
    outlet_id: "out_001",
    name: "Rooftop",
    code: "FL-RT",
    description: "Open-air terrace with city view",
    level: 2,
    capacity: 40,
    sort_order: 2,
    is_active: true,
    is_outdoor: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "fl_004",
    outlet_id: "out_001",
    name: "Basement",
    code: "FL-BM",
    description: "Private dining / banquet",
    level: -1,
    capacity: 50,
    sort_order: 3,
    is_active: false,
    is_outdoor: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function sortedFloors(): Floor[] {
  return [...mockFloors].sort((a, b) => a.sort_order - b.sort_order || a.level - b.level);
}

export async function getFloors(filters?: FloorFilters): Promise<Floor[]> {
  await delay(400);
  let result = sortedFloors();
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (f) => f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q),
    );
  }
  if (filters?.is_active !== undefined) {
    result = result.filter((f) => f.is_active === filters.is_active);
  }
  return result;
}

export async function getFloorById(id: string): Promise<Floor | null> {
  await delay(300);
  return mockFloors.find((f) => f.id === id) ?? null;
}

export async function createFloor(payload: FloorPayload): Promise<Floor> {
  await delay(600);
  if (mockFloors.some((f) => f.code.toLowerCase() === payload.code.toLowerCase())) {
    throw new Error(`Floor code "${payload.code}" already exists`);
  }
  const now = new Date().toISOString();
  const floor: Floor = {
    id: `fl_${Date.now().toString(36)}`,
    outlet_id: "out_001",
    name: payload.name,
    code: payload.code.toUpperCase(),
    description: payload.description,
    level: payload.level ?? 0,
    capacity: payload.capacity ?? 20,
    sort_order: payload.sort_order ?? mockFloors.length,
    is_active: payload.is_active ?? true,
    is_outdoor: payload.is_outdoor,
    created_at: now,
    updated_at: now,
  };
  mockFloors.push(floor);
  return { ...floor };
}

export async function updateFloor(id: string, payload: FloorPayload): Promise<Floor> {
  await delay(600);
  const idx = mockFloors.findIndex((f) => f.id === id);
  if (idx === -1) throw new Error("Floor not found");
  if (
    payload.code &&
    mockFloors.some((f) => f.id !== id && f.code.toLowerCase() === payload.code!.toLowerCase())
  ) {
    throw new Error(`Floor code "${payload.code}" already exists`);
  }
  const updated: Floor = {
    ...mockFloors[idx],
    ...payload,
    code: payload.code ? payload.code.toUpperCase() : mockFloors[idx].code,
    updated_at: new Date().toISOString(),
  };
  mockFloors[idx] = updated;
  return { ...updated };
}

export async function deleteFloor(id: string): Promise<void> {
  await delay(500);
  const idx = mockFloors.findIndex((f) => f.id === id);
  if (idx === -1) throw new Error("Floor not found");
  mockFloors.splice(idx, 1);
}
