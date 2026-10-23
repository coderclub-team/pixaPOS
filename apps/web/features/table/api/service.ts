/**
 * Tables domain — server-backed (Postgres via /api/tables*, /api/floors*).
 *
 * Same exported API as the old localStorage version so all callers
 * (terminal floor map, table-ops dialog, dashboard settings) work unchanged.
 * Reads are outlet-scoped server-side; writes carry the caller's outlet and
 * actor through. No local persistence, no mock data, no cross-tab mirror —
 * the server is the single source of truth.
 */
import type {
  RestaurantTable,
  TableFilters,
  TablePayload,
  OccupancyGroup,
  TableBlock,
  ReservationHold,
  TableWithDerived,
  CommandContext,
  TableStatus,
} from "./types";
import { getServiceOutletId } from "@/features/outlet/api/outlets";

function defaultCtx(ctx?: Partial<CommandContext>): CommandContext {
  return {
    outlet_id: ctx?.outlet_id ?? getServiceOutletId() ?? "",
    actor_id: ctx?.actor_id ?? "staff",
    ...(ctx?.idempotency_key !== undefined ? { idempotency_key: ctx.idempotency_key } : {}),
    ...(ctx?.expected_version !== undefined ? { expected_version: ctx.expected_version } : {}),
  };
}

function ctxOf(ctx?: Partial<CommandContext>): CommandContext {
  return defaultCtx(ctx);
}

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

/* ---------------- queries ---------------- */

export async function getTables(filters?: TableFilters): Promise<TableWithDerived[]> {
  const { rows } = await api<{ rows: TableWithDerived[] }>(
    `/api/tables${toQuery({
      outlet_id: filters?.outlet_id,
      floor_id: filters?.floor_id,
      status: filters?.status as string | undefined,
      is_active: filters?.is_active,
      search: filters?.search,
    })}`,
  );
  return rows ?? [];
}

export async function getTableById(id: string): Promise<TableWithDerived | null> {
  try {
    const { row } = await api<{ row: TableWithDerived | null }>(
      `/api/tables/${encodeURIComponent(id)}`,
    );
    return row ?? null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function getTablesWithDerivedByFloor(floorId: string): Promise<{
  tables: TableWithDerived[];
  groups: OccupancyGroup[];
  blocks: TableBlock[];
  holds: ReservationHold[];
}> {
  const data = await api<{
    tables: TableWithDerived[];
    groups: OccupancyGroup[];
    blocks: TableBlock[];
    holds: ReservationHold[];
  }>(`/api/floors/${encodeURIComponent(floorId)}/layout`);
  return {
    tables: data.tables ?? [],
    groups: data.groups ?? [],
    blocks: data.blocks ?? [],
    holds: data.holds ?? [],
  };
}

const DUPLICATE_POSE_OFFSET_MM = 200;

function incrementTrailing(value: string): string | null {
  const m = value.match(/^(.*?)(\d+)$/);
  if (!m) return null;
  const next = parseInt(m[2], 10) + 1;
  return `${m[1]}${next.toString().padStart(m[2].length, "0")}`;
}

export function suggestUniqueTableValue(taken: Iterable<string>, base: string): string {
  const takenUpper = new Set([...taken].map((t) => t.toUpperCase()));
  let candidate = incrementTrailing(base);
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

export function suggestDuplicateIdentifiers(
  source: Pick<RestaurantTable, "outlet_id" | "number" | "code">,
  existing: Pick<RestaurantTable, "outlet_id" | "number" | "code" | "deleted_at">[],
): { number: string; code: string } {
  const outletTables = existing.filter((t) => t.outlet_id === source.outlet_id && !t.deleted_at);
  return {
    number: suggestUniqueTableValue(
      outletTables.map((t) => t.number),
      source.number,
    ),
    code: suggestUniqueTableValue(
      outletTables.map((t) => t.code),
      source.code,
    ),
  };
}

export async function duplicateTable(
  id: string,
  overrides?: Partial<TablePayload>,
): Promise<TableWithDerived> {
  const source = await getTableById(id);
  if (!source) throw new Error("Table not found");
  const outletId = overrides?.outlet_id ?? source.outlet_id ?? getServiceOutletId() ?? undefined;
  const tables = await getTables(outletId ? { outlet_id: outletId } : {});
  const outletTables = tables.filter((t) => !t.deleted_at && t.outlet_id === outletId);
  const number = (
    overrides?.number ??
    suggestUniqueTableValue(
      outletTables.map((t) => t.number),
      source.number,
    )
  ).toUpperCase();
  const code = (
    overrides?.code ??
    suggestUniqueTableValue(
      outletTables.map((t) => t.code),
      source.code,
    )
  ).toUpperCase();
  return createTable(
    {
      outlet_id: outletId,
      floor_id: overrides?.floor_id ?? source.floor_id,
      number,
      code,
      capacity: overrides?.capacity ?? source.capacity,
      shape: (overrides?.shape as TablePayload["shape"]) ?? source.shape,
      type: (overrides as Record<string, unknown> | undefined)?.type as TablePayload extends never
        ? never
        : (TablePayload & { type?: RestaurantTable["type"] })["type"] extends infer _T
          ? RestaurantTable["type"]
          : never,
      allows_sharing: (overrides as Record<string, unknown> | undefined)?.allows_sharing as
        | boolean
        | undefined,
      is_active: overrides?.is_active ?? true,
      sort_order:
        overrides?.sort_order ?? Math.max(0, ...outletTables.map((t) => t.sort_order || 0)) + 1,
      x_mm: Math.max(0, source.x_mm + DUPLICATE_POSE_OFFSET_MM),
      y_mm: Math.max(0, source.y_mm + DUPLICATE_POSE_OFFSET_MM),
      w_mm: source.w_mm,
      h_mm: source.h_mm,
      rotation_deg: source.rotation_deg,
      z_index: source.z_index,
    } as TablePayload,
    { outlet_id: outletId },
  );
}

export async function createTable(
  payload: TablePayload,
  ctx?: Partial<CommandContext>,
): Promise<TableWithDerived> {
  const c = ctxOf(ctx);
  const { row } = await api<{ row: TableWithDerived }>(`/api/tables`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, outlet_id: payload.outlet_id ?? c.outlet_id }),
  });
  if (!row) throw new Error("Table created but could not be reloaded");
  return row;
}

export async function updateTable(
  id: string,
  payload: TablePayload,
  ctx?: Partial<CommandContext>,
): Promise<TableWithDerived> {
  const c = ctxOf(ctx);
  const { row } = await api<{ row: TableWithDerived }>(`/api/tables/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, outlet_id: payload.outlet_id ?? c.outlet_id }),
  });
  if (!row) throw new Error("Table not found");
  return row;
}

export async function deleteTable(id: string): Promise<void> {
  await api(`/api/tables/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function setTablePose(
  id: string,
  params: { x_mm?: number; y_mm?: number; w_mm?: number; h_mm?: number; rotation_deg?: number },
): Promise<void> {
  await api(`/api/tables/${encodeURIComponent(id)}/pose`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function moveTable(id: string, params: { x_mm: number; y_mm: number }): Promise<void> {
  return setTablePose(id, params);
}

export async function resizeTable(
  id: string,
  params: { w_mm: number; h_mm: number },
): Promise<void> {
  return setTablePose(id, params);
}

export async function rotateTable(id: string, params: { rotation_deg: number }): Promise<void> {
  return setTablePose(id, params);
}

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
  const c = ctxOf(params.ctx);
  const { group } = await api<{ group: OccupancyGroup }>(
    `/api/tables/${encodeURIComponent(params.table_id)}/occupancy`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "seat",
        seats: params.seats,
        created_by: params.created_by ?? c.actor_id,
        hold_id: params.hold_id,
        force: params.force,
        reason: params.reason,
        group_id: params.group_id,
        outlet_id: c.outlet_id,
      }),
    },
  );
  if (!group) throw new Error("Seating failed");
  return group;
}

export async function getOccupancyGroup(groupId: string): Promise<OccupancyGroup | null> {
  try {
    const { group } = await api<{ group: OccupancyGroup | null }>(
      `/api/occupancy-groups/${encodeURIComponent(groupId)}`,
    );
    return group ?? null;
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function releaseOccupancy(params: {
  group_id: string;
  released_by?: string;
  reason: string;
  force?: boolean;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  const c = ctxOf(params.ctx);
  // Resolve the table for the route path.
  const current = await getOccupancyGroup(params.group_id);
  if (!current) throw new Error("Group not found");
  await api(`/api/tables/${encodeURIComponent(current.table_id)}/occupancy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "release",
      group_id: params.group_id,
      released_by: params.released_by ?? c.actor_id,
      reason: params.reason,
      force: params.force,
      outlet_id: c.outlet_id,
    }),
  });
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
  const c = ctxOf(params.ctx);
  const current = await getOccupancyGroup(params.group_id);
  if (!current) throw new Error("Group not found");
  const { group } = await api<{ group: OccupancyGroup }>(
    `/api/tables/${encodeURIComponent(current.table_id)}/occupancy`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "add-guests",
        group_id: params.group_id,
        extra_seats: params.extra_seats,
        outlet_id: c.outlet_id,
      }),
    },
  );
  if (!group) throw new Error("Add guests failed");
  return group;
}

export async function attachOrder(params: {
  group_id: string;
  order_id: string;
  ctx?: Partial<CommandContext>;
}): Promise<OccupancyGroup> {
  const c = ctxOf(params.ctx);
  const current = await getOccupancyGroup(params.group_id);
  if (!current) throw new Error("Group not found");
  const { group } = await api<{ group: OccupancyGroup }>(
    `/api/tables/${encodeURIComponent(current.table_id)}/occupancy`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "attach-order",
        group_id: params.group_id,
        order_id: params.order_id,
        outlet_id: c.outlet_id,
      }),
    },
  );
  if (!group) throw new Error("Attach failed");
  return group;
}

export async function detachOrder(params: {
  group_id: string;
  order_id: string;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  const c = ctxOf(params.ctx);
  const current = await getOccupancyGroup(params.group_id);
  if (!current) return;
  await api(`/api/tables/${encodeURIComponent(current.table_id)}/occupancy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "detach-order",
      group_id: params.group_id,
      order_id: params.order_id,
      outlet_id: c.outlet_id,
    }),
  });
}

export async function cancelOccupancy(params: {
  group_id: string;
  by?: string;
  reason: string;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  const c = ctxOf(params.ctx);
  const current = await getOccupancyGroup(params.group_id);
  if (!current) throw new Error("Group not found");
  await api(`/api/tables/${encodeURIComponent(current.table_id)}/occupancy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "cancel",
      group_id: params.group_id,
      by: params.by ?? c.actor_id,
      reason: params.reason,
      outlet_id: c.outlet_id,
    }),
  });
}

export async function transferOccupancy(params: {
  group_ids: string[];
  to_table_id: string;
  moved_by?: string;
  reason: string;
  ctx?: Partial<CommandContext>;
}): Promise<OccupancyGroup[]> {
  const c = ctxOf(params.ctx);
  // Resolve the source table for the route path.
  const first = params.group_ids[0] ? await getOccupancyGroup(params.group_ids[0]) : null;
  if (!first) throw new Error("Group not found");
  const { moved } = await api<{ moved: OccupancyGroup[] }>(
    `/api/tables/${encodeURIComponent(first.table_id)}/occupancy`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "transfer",
        group_ids: params.group_ids,
        to_table_id: params.to_table_id,
        moved_by: params.moved_by ?? c.actor_id,
        reason: params.reason,
        outlet_id: c.outlet_id,
      }),
    },
  );
  return moved ?? [];
}

export async function markCleaned(params: {
  table_id: string;
  by?: string;
  ctx?: Partial<CommandContext>;
}): Promise<TableWithDerived> {
  const c = ctxOf(params.ctx);
  const { table } = await api<{ table: TableWithDerived }>(
    `/api/tables/${encodeURIComponent(params.table_id)}/status`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: "available",
        by: params.by ?? c.actor_id,
        outlet_id: c.outlet_id,
      }),
    },
  );
  if (!table) throw new Error("Table not found");
  return table;
}

export async function setTableStatus(params: {
  table_id: string;
  to: TableWithDerived["status"];
  reason: string;
  by?: string;
  ctx?: Partial<CommandContext>;
}): Promise<TableWithDerived> {
  const c = ctxOf(params.ctx);
  if (params.to === "available")
    return markCleaned({ table_id: params.table_id, by: params.by, ctx: params.ctx });
  const { table } = await api<{ table: TableWithDerived }>(
    `/api/tables/${encodeURIComponent(params.table_id)}/status`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: params.to,
        reason: params.reason,
        by: params.by ?? c.actor_id,
        outlet_id: c.outlet_id,
      }),
    },
  );
  if (!table) throw new Error("Table not found");
  return table;
}

export async function blockTable(params: {
  table_id: string;
  reason: string;
  by?: string;
  until_at?: string;
  ctx?: Partial<CommandContext>;
}): Promise<import("./types").TableBlock> {
  const c = ctxOf(params.ctx);
  const { block } = await api<{ block: import("./types").TableBlock }>(
    `/api/tables/${encodeURIComponent(params.table_id)}/block`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: params.reason,
        by: params.by ?? c.actor_id,
        until_at: params.until_at,
        outlet_id: c.outlet_id,
      }),
    },
  );
  if (!block) throw new Error("Block failed");
  return block;
}

export async function unblockTable(params: {
  table_id: string;
  by?: string;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  const c = ctxOf(params.ctx);
  await api(`/api/tables/${encodeURIComponent(params.table_id)}/block`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ by: params.by ?? c.actor_id, outlet_id: c.outlet_id }),
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
  ctx?: Partial<CommandContext>;
}): Promise<import("./types").ReservationHold> {
  const c = ctxOf(params.ctx);
  const { hold } = await api<{ hold: import("./types").ReservationHold }>(
    `/api/tables/${encodeURIComponent(params.table_id)}/holds`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        holder_name: params.holder_name,
        holder_phone: params.holder_phone,
        party_size: params.party_size,
        hold_from: params.hold_from,
        hold_until: params.hold_until,
        outlet_id: c.outlet_id,
      }),
    },
  );
  if (!hold) throw new Error("Hold creation failed");
  return hold;
}

export async function cancelHold(params: {
  hold_id: string;
  by?: string;
  reason?: string;
  ctx?: Partial<CommandContext>;
}): Promise<void> {
  const c = ctxOf(params.ctx);
  await api(`/api/holds/${encodeURIComponent(params.hold_id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "cancel", by: params.by ?? c.actor_id, reason: params.reason }),
  });
}

export async function expireHold(params: { hold_id: string }): Promise<void> {
  await api(`/api/holds/${encodeURIComponent(params.hold_id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "expire" }),
  });
  return;
}
