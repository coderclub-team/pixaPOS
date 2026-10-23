/**
 * Floors domain — server-backed (Postgres via /api/floors*).
 *
 * Same exported API as the old localStorage version so all callers work
 * unchanged. No local persistence, no mock data — the server is the single
 * source of truth.
 */
import type {
  Floor,
  FloorFilters,
  FloorPayload,
  FloorLayout,
  ReorderFloorInput,
  FloorObject,
} from "./types";
import { getServiceOutletId } from "@/features/outlet/api/outlets";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  const data = (await res.json().catch(() => null)) as { error?: string } | T | null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : typeof v === "string" ? v : new Date().toISOString();
const isoOrNull = (v: unknown): string | null => {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
};

function toClientFloor(r: Record<string, unknown>): Floor {
  return {
    id: String(r.id),
    outlet_id: String(r.outletId),
    name: String(r.name ?? ""),
    code: String(r.code ?? ""),
    description: (r.description as string | null) ?? undefined,
    level: Number(r.level ?? 0),
    capacity: Number(r.capacity ?? 20),
    sort_order: Number(r.sortOrder ?? 0),
    is_active: (r.isActive as boolean | undefined) ?? true,
    is_outdoor: (r.isOutdoor as boolean | undefined) ?? undefined,
    width_mm: Number(r.widthMm ?? 12000),
    height_mm: Number(r.heightMm ?? 8000),
    grid_size_mm: Number(r.gridSizeMm ?? 100),
    background_color: (r.backgroundColor as string | null) ?? undefined,
    background_image_url: (r.backgroundImageUrl as string | null) ?? undefined,
    deleted_at: isoOrNull(r.deletedAt),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    version: Number(r.version ?? 1),
  };
}

function toClientObject(r: Record<string, unknown>): FloorObject {
  return {
    id: String(r.id),
    floor_id: String(r.floorId),
    outlet_id: String(r.outletId),
    kind: r.kind as FloorObject["kind"],
    shapeVariant: (r.shapeVariant as FloorObject["shapeVariant"]) ?? undefined,
    label: (r.label as string | null) ?? undefined,
    x_mm: Number(r.xMm ?? 0),
    y_mm: Number(r.yMm ?? 0),
    w_mm: Number(r.wMm ?? 0),
    h_mm: Number(r.hMm ?? 0),
    rotation_deg: Number(r.rotationDeg ?? 0),
    z_index: Number(r.zIndex ?? 0),
    color: (r.color as string | null) ?? undefined,
    deleted_at: isoOrNull(r.deletedAt),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    version: Number(r.version ?? 1),
  };
}

export async function getFloors(filters?: FloorFilters): Promise<Floor[]> {
  const { rows } = await api<{ rows: Record<string, unknown>[] }>(
    `/api/floors${toQuery({
      outlet_id: filters?.outlet_id,
      search: filters?.search,
      is_active: filters?.is_active,
    })}`,
  );
  return (rows ?? []).map(toClientFloor).sort((a, b) => a.sort_order - b.sort_order);
}

export async function getFloorById(id: string): Promise<Floor | null> {
  try {
    const { row } = await api<{ row: Record<string, unknown> | null }>(
      `/api/floors/${encodeURIComponent(id)}`,
    );
    return row ? toClientFloor(row) : null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function getFloorLayout(floorId: string): Promise<FloorLayout> {
  const data = await api<{
    floor: Record<string, unknown>;
    tables: Record<string, unknown>[];
    groups: Record<string, unknown>[];
    blocks: Record<string, unknown>[];
    holds: Record<string, unknown>[];
    objects: Record<string, unknown>[];
  }>(`/api/floors/${encodeURIComponent(floorId)}/layout`);
  const { deriveTableInfo } = await import("@/features/table/api/utils");
  const groupsByTable = new Map<string, Record<string, unknown>[]>();
  for (const g of data.groups ?? []) {
    const k = String((g as Record<string, unknown>).tableId);
    if (!groupsByTable.has(k)) groupsByTable.set(k, []);
    groupsByTable.get(k)!.push(g as Record<string, unknown>);
  }
  const toClientGroup = (g: Record<string, unknown>) => ({
    id: String(g.id),
    table_id: String(g.tableId),
    outlet_id: String(g.outletId),
    floor_id: String(g.floorId ?? ""),
    seats: Number(g.seats),
    label: (g.label as string | null) ?? undefined,
    color_index: Number(g.colorIndex ?? 0),
    order_id: (g.orderId as string | null) ?? null,
    status: g.status as "SEATED" | "ORDERING" | "RELEASED" | "CANCELLED",
    seated_at: iso(g.seatedAt),
    released_at: (g.releasedAt as string | null) ? iso(g.releasedAt) : undefined,
    release_reason: (g.releaseReason as string | null) ?? undefined,
    force_released: (g.forceReleased as boolean | undefined) ?? undefined,
    created_at: iso(g.createdAt),
    updated_at: iso(g.updatedAt),
    version: Number(g.version ?? 1),
  });
  const toClientBlock = (b: Record<string, unknown>) => ({
    id: String(b.id),
    table_id: String(b.tableId),
    outlet_id: String(b.outletId),
    reason: String(b.reason ?? ""),
    blocked_at: iso(b.blockedAt),
    blocked_by: (b.blockedBy as string | null) ?? undefined,
    until_at: b.untilAt ? iso(b.untilAt) : undefined,
    released_at: b.releasedAt ? iso(b.releasedAt) : undefined,
    released_by: (b.releasedBy as string | null) ?? undefined,
    created_at: iso(b.createdAt),
  });
  const toClientHold = (h: Record<string, unknown>) => ({
    id: String(h.id),
    table_id: String(h.tableId),
    outlet_id: String(h.outletId),
    holder_name: String(h.holderName ?? ""),
    holder_phone: (h.holderPhone as string | null) ?? undefined,
    party_size: Number(h.partySize),
    hold_from: iso(h.holdFrom),
    hold_until: iso(h.holdUntil),
    status: h.status,
    cancelled_by: (h.cancelledBy as string | null) ?? undefined,
    cancelled_at: h.cancelledAt ? iso(h.cancelledAt) : undefined,
    created_at: iso(h.createdAt),
    version: Number(h.version ?? 1),
  });
  const tables = (data.tables ?? []).map((t) => {
    const tid = String((t as Record<string, unknown>).id);
    const active = (groupsByTable.get(tid) ?? []).map(toClientGroup);
    const blockRow = (data.blocks ?? []).find(
      (b) => String((b as Record<string, unknown>).tableId) === tid,
    ) as Record<string, unknown> | undefined;
    const holdRow = (data.holds ?? []).find(
      (h) => String((h as Record<string, unknown>).tableId) === tid,
    ) as Record<string, unknown> | undefined;
    const base = {
      id: tid,
      outlet_id: String((t as Record<string, unknown>).outletId),
      floor_id: String((t as Record<string, unknown>).floorId),
      number: String((t as Record<string, unknown>).number),
      code: String((t as Record<string, unknown>).code),
      capacity: Number((t as Record<string, unknown>).capacity),
      shape: (t as Record<string, unknown>).shape,
      type: (t as Record<string, unknown>).type,
      allows_sharing: (t as Record<string, unknown>).allowsSharing,
      status: (t as Record<string, unknown>).status,
      is_active: (t as Record<string, unknown>).isActive,
      sort_order: Number((t as Record<string, unknown>).sortOrder ?? 0),
      x_mm: Number((t as Record<string, unknown>).xMm ?? 0),
      y_mm: Number((t as Record<string, unknown>).yMm ?? 0),
      w_mm: Number((t as Record<string, unknown>).wMm ?? 0),
      h_mm: Number((t as Record<string, unknown>).hMm ?? 0),
      rotation_deg: Number((t as Record<string, unknown>).rotationDeg ?? 0),
      z_index: Number((t as Record<string, unknown>).zIndex ?? 0),
      deleted_at: null,
      created_at: iso((t as Record<string, unknown>).createdAt),
      updated_at: iso((t as Record<string, unknown>).updatedAt),
      version: Number((t as Record<string, unknown>).version ?? 1),
    };
    const info = deriveTableInfo(
      base as never,
      active as never,
      blockRow ? (toClientBlock(blockRow) as never) : undefined,
      holdRow ? (toClientHold(holdRow) as never) : undefined,
    );
    return {
      ...base,
      occupancy_fill: info.occupancyFill,
      seated_seats: info.seatedSeats,
      active_groups: active,
      active_block: blockRow ? toClientBlock(blockRow) : undefined,
      active_hold: holdRow ? toClientHold(holdRow) : undefined,
    };
  });
  return {
    floor: toClientFloor(data.floor),
    tables,
    groups: (data.groups ?? []).map(toClientGroup),
    objects: (data.objects ?? []).map(toClientObject),
  } as unknown as FloorLayout;
}

export async function createFloorObject(payload: {
  floor_id: string;
  kind: FloorObject["kind"];
  shapeVariant?: FloorObject["shapeVariant"];
  label?: string;
  x_mm?: number;
  y_mm?: number;
  w_mm?: number;
  h_mm?: number;
  rotation_deg?: number;
  color?: string;
}): Promise<FloorObject> {
  const { row } = await api<{ row: Record<string, unknown> }>(
    `/api/floors/${encodeURIComponent(payload.floor_id)}/objects`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!row) throw new Error("Floor object created but could not be reloaded");
  return toClientObject(row);
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
  await api(`/api/floor-objects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function deleteFloorObject(id: string): Promise<void> {
  await api(`/api/floor-objects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function createFloor(payload: FloorPayload): Promise<Floor> {
  const outletId = payload.outlet_id ?? getServiceOutletId() ?? undefined;
  if (!outletId) throw new Error("No outlet selected — create one first");
  const { row } = await api<{ row: Record<string, unknown> }>(`/api/floors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, outlet_id: outletId }),
  });
  if (!row) throw new Error("Floor created but could not be reloaded");
  return toClientFloor(row);
}

export async function updateFloor(id: string, payload: FloorPayload): Promise<Floor> {
  await api(`/api/floors/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const row = await getFloorById(id);
  if (!row) throw new Error("Floor not found");
  return row;
}

export async function reorderFloors(input: ReorderFloorInput[]): Promise<void> {
  await api(`/api/floors/reorder`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: input }),
  });
}

export async function deleteFloor(id: string): Promise<void> {
  await api(`/api/floors/${encodeURIComponent(id)}`, { method: "DELETE" });
}
