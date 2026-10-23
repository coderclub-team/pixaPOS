/**
 * Kitchen/KDS domain — server implementation (Postgres via Drizzle).
 *
 * Strict ticket + line state machines from docs/workflows.md §3 (same guards
 * as the local version). KOTs are immutable once fired except status
 * transitions and void/return records.
 *
 * Server-only: import from API routes. May import orders/server (one-way:
 * orders never imports kitchen — orchestration crossing both domains lives
 * in the route handlers or here, never back).
 */
import { and, eq, inArray } from "drizzle-orm";
import { ulid } from "@pixa/contracts";
import { db, kotLines, kots, outletKitchenStations } from "@pixa/db";
import { recordServerEvent } from "@/features/events/api/server";
import { advanceOrderForKitchen, getOrderById } from "@/features/orders/api/server";
import type {
  KitchenTicket,
  KitchenTicketWithDerived,
  KOTLine,
  KOTLineStatus,
  KOTStatus,
  KOTVoidRecord,
} from "./types";

export type ServerCtx = {
  organizationId: string;
  outletId?: string | null;
  actorId?: string | null;
};

const KOT_TRANSITIONS: Record<KOTStatus, KOTStatus[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: [],
};

const KOT_LINE_TRANSITIONS: Record<KOTLineStatus, KOTLineStatus[]> = {
  PENDING: ["ACCEPTED", "PREPARING", "VOIDED"],
  ACCEPTED: ["PREPARING", "VOIDED"],
  PREPARING: ["READY", "VOIDED"],
  READY: ["SERVED", "VOIDED"],
  SERVED: [],
  VOIDED: [],
};

function assertLineTransition(from: KOTLineStatus, to: KOTLineStatus, what: string): void {
  if (from === to) return;
  if (!KOT_LINE_TRANSITIONS[from].includes(to)) {
    throw new Error(`Illegal KOT line transition ${from} → ${to} (${what})`);
  }
}

function toClientLine(l: Record<string, unknown>): KOTLine {
  return {
    id: String(l.id),
    order_line_id: String(l.orderLineId),
    item_name_snapshot: String(l.itemNameSnapshot ?? ""),
    variant_name_snapshot: (l.variantNameSnapshot as string | null) ?? undefined,
    modifiers_snapshot: (l.modifiersSnapshot as string[] | null) ?? [],
    instructions: (l.instructions as string | null) ?? undefined,
    qty: Number(l.qty),
    voided_qty: Number(l.voidedQty ?? 0),
    returned_qty: Number(l.returnedQty ?? 0),
    status: l.status as KOTLineStatus,
  };
}

function toClientTicket(
  t: Record<string, unknown>,
  lines: KOTLine[],
  voids: Record<string, unknown>[],
  returns: Record<string, unknown>[],
): KitchenTicket {
  return {
    id: String(t.id),
    outlet_id: String(t.outletId),
    order_id: String(t.orderId),
    order_number_snapshot: String(t.orderNumberSnapshot ?? ""),
    table_number_snapshot: (t.tableNumberSnapshot as string | null) ?? undefined,
    channel: String(t.channel ?? "dine_in"),
    kot_number: Number(t.kotNumber ?? 0),
    status: t.status as KOTStatus,
    lines,
    voids: voids.map((v) => ({
      id: String(v.id ?? `void_${t.id}`),
      kot_id: String(v.kotId ?? t.id),
      kot_line_id: v.kotLineId != null ? String(v.kotLineId) : undefined,
      qty: Number(v.qty ?? 0),
      reason: String(v.reason ?? ""),
      voided_by: v.voidedBy != null ? String(v.voidedBy) : undefined,
      created_at:
        v.createdAt instanceof Date ? v.createdAt.toISOString() : new Date().toISOString(),
    })),
    returns: returns.map((r) => ({
      id: String((r as Record<string, unknown>).id ?? `ret_${t.id}`),
      kot_id: String(t.id),
      kot_line_id:
        (r as Record<string, unknown>).kotLineId != null
          ? String((r as Record<string, unknown>).kotLineId)
          : undefined,
      order_line_id: String((r as Record<string, unknown>).orderLineId ?? ""),
      qty: Number((r as Record<string, unknown>).qty ?? 0),
      amount_paise: Number((r as Record<string, unknown>).amountPaise ?? 0),
      reason: String((r as Record<string, unknown>).reason ?? ""),
      returned_by:
        (r as Record<string, unknown>).returnedBy != null
          ? String((r as Record<string, unknown>).returnedBy)
          : undefined,
      created_at:
        (r as Record<string, unknown>).createdAt instanceof Date
          ? ((r as Record<string, unknown>).createdAt as Date).toISOString()
          : new Date().toISOString(),
    })),
    station_ids: (t.stationIds as string[] | null) ?? undefined,
    fired_by: (t.firedBy as string | null) ?? undefined,
    fired_at:
      t.firedAt instanceof Date
        ? (t.firedAt as Date).toISOString()
        : typeof t.firedAt === "string"
          ? t.firedAt
          : new Date().toISOString(),
    updated_at:
      t.updatedAt instanceof Date
        ? (t.updatedAt as Date).toISOString()
        : typeof t.updatedAt === "string"
          ? t.updatedAt
          : new Date().toISOString(),
    version: Number(t.version ?? 1),
  } as KitchenTicket;
}

function enrichTicket(t: KitchenTicket): KitchenTicketWithDerived {
  return {
    ...t,
    pending_lines: t.lines.filter(
      (l) => l.status === "PENDING" || l.status === "ACCEPTED" || l.status === "PREPARING",
    ).length,
    ready_lines: t.lines.filter((l) => l.status === "READY").length,
    age_minutes: Math.max(0, Math.round((Date.now() - new Date(t.fired_at).getTime()) / 60000)),
  };
}

async function loadTicket(
  organizationId: string,
  id: string,
): Promise<{ row: Record<string, unknown>; lines: Record<string, unknown>[] } | null> {
  const rows = (await db()
    .select()
    .from(kots)
    .where(and(eq(kots.organizationId, organizationId), eq(kots.id, id)))
    .limit(1)) as unknown as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  const lines = (await db()
    .select()
    .from(kotLines)
    .where(and(eq(kotLines.organizationId, organizationId), eq(kotLines.kotId, id)))
    .orderBy(kotLines.id)) as unknown as Record<string, unknown>[];
  return { row, lines };
}

/* ---------------- reads ---------------- */

export async function getKitchenTickets(
  organizationId: string,
  filters?: { outlet_id?: string | null; status?: import("./types").KOTStatus },
): Promise<KitchenTicketWithDerived[]> {
  return getKitchenTicketsForOutlet(organizationId, filters?.outlet_id ?? null, filters?.status);
}

export async function getKitchenTicketsForOutlet(
  organizationId: string,
  outletId: string | null | undefined,
  status?: KOTStatus,
): Promise<KitchenTicketWithDerived[]> {
  const conds = [eq(kots.organizationId, organizationId)];
  if (outletId) conds.push(eq(kots.outletId, outletId));
  if (status) conds.push(eq(kots.status, status as string));
  const rows = (await db()
    .select()
    .from(kots)
    .where(and(...conds))
    .orderBy(kots.firedAt)) as unknown as Record<string, unknown>[];
  const out: KitchenTicketWithDerived[] = [];
  for (const r of rows) {
    const lines = (await db()
      .select()
      .from(kotLines)
      .where(and(eq(kotLines.organizationId, organizationId), eq(kotLines.kotId, String(r.id))))
      .orderBy(kotLines.id)) as unknown as Record<string, unknown>[];
    const t = toClientTicket(
      r,
      lines.map(toClientLine),
      (Array.isArray(r.voids) ? r.voids : []) as Record<string, unknown>[],
      (Array.isArray(r.returns) ? r.returns : []) as Record<string, unknown>[],
    );
    out.push(enrichTicket(t));
  }
  return out.sort((a, b) => a.fired_at.localeCompare(b.fired_at));
}

export async function getKOTsByOrder(
  organizationId: string,
  orderId: string,
): Promise<KitchenTicketWithDerived[]> {
  const rows = (await db()
    .select()
    .from(kots)
    .where(and(eq(kots.organizationId, organizationId), eq(kots.orderId, orderId)))
    .orderBy(kots.kotNumber)) as unknown as Record<string, unknown>[];
  const out: KitchenTicketWithDerived[] = [];
  for (const r of rows) {
    const lines = (await db()
      .select()
      .from(kotLines)
      .where(and(eq(kotLines.organizationId, organizationId), eq(kotLines.kotId, String(r.id))))
      .orderBy(kotLines.id)) as unknown as Record<string, unknown>[];
    const t = toClientTicket(
      r,
      lines.map(toClientLine),
      (Array.isArray(r.voids) ? r.voids : []) as Record<string, unknown>[],
      (Array.isArray(r.returns) ? r.returns : []) as Record<string, unknown>[],
    );
    out.push(enrichTicket(t));
  }
  return out;
}

export async function getTicketById(
  organizationId: string,
  id: string,
): Promise<KitchenTicketWithDerived | null> {
  const found = await loadTicket(organizationId, id);
  if (!found) return null;
  const t = toClientTicket(
    found.row,
    found.lines.map(toClientLine),
    (Array.isArray(found.row.voids) ? found.row.voids : []) as Record<string, unknown>[],
    (Array.isArray(found.row.returns) ? found.row.returns : []) as Record<string, unknown>[],
  );
  return enrichTicket(t);
}

/* ---------------- fire ---------------- */

export interface FireResult {
  ticket: KitchenTicketWithDerived;
  marks: { line_id: string; kot_id: string; kot_line_id: string }[];
}

export async function fireKOT(
  organizationId: string,
  orderId: string,
  opts: { by?: string; stationIds?: string[]; outletId?: string | null },
): Promise<{
  ticket: KitchenTicketWithDerived;
  order: import("@/features/orders/api/types").OrderWithDerived;
}> {
  const { getOrderRow } = await import("@/features/orders/api/server");
  const found = await getOrderRow(organizationId, orderId);
  if (!found) throw new Error("Order not found");
  if (String(found.row.status) === "CANCELLED" || String(found.row.status) === "COMPLETED") {
    throw new Error(`Cannot fire KOT for a ${String(found.row.status).toLowerCase()} order`);
  }
  const draftLines = found.items.filter((i) => !(i as Record<string, unknown>).kotId) as Record<
    string,
    unknown
  >[];
  if (draftLines.length === 0) throw new Error("No new items to fire");
  // Modifier-group min/max guard (per-line picks vs required groups).
  const { menuItems, modifiers: menuModifiersTable, modifierGroups } = await import("@pixa/db");
  const menuItemIds = [...new Set(draftLines.map((l) => String(l.menuItemId)))];
  const menuRows = menuItemIds.length
    ? ((await db()
        .select()
        .from(menuItems)
        .where(
          and(eq(menuItems.organizationId, organizationId), inArray(menuItems.id, menuItemIds)),
        )) as unknown as Record<string, any>[])
    : [];
  const groupIds = [
    ...new Set(
      menuRows.flatMap(
        (m) => (Array.isArray(m.modifierGroupIds) ? m.modifierGroupIds : []) as string[],
      ),
    ),
  ];
  const groupRows = groupIds.length
    ? ((await db()
        .select()
        .from(modifierGroups)
        .where(
          and(
            eq(modifierGroups.organizationId, organizationId),
            inArray(modifierGroups.id, groupIds),
          ),
        )) as unknown as Record<string, any>[])
    : [];
  const byGroup = new Map(groupRows.map((g) => [String(g.id), g]));
  const byItem = new Map(menuRows.map((m) => [String(m.id), m]));
  const modRows = await (async () => {
    const allIds = [
      ...new Set(
        draftLines.flatMap((l) =>
          Array.isArray((l as Record<string, unknown>).modifierIds)
            ? ((l as Record<string, unknown>).modifierIds as string[])
            : [],
        ),
      ),
    ];
    if (!allIds.length) return [] as Record<string, unknown>[];
    return (await db()
      .select()
      .from(menuModifiersTable)
      .where(
        and(
          eq(menuModifiersTable.organizationId, organizationId),
          inArray(menuModifiersTable.id, allIds),
        ),
      )) as unknown as Record<string, unknown>[];
  })();
  const modGroupOf = new Map(modRows.map((m) => [String(m.id), String(m.groupId)]));
  for (const line of draftLines) {
    const item = byItem.get(String((line as Record<string, unknown>).menuItemId));
    if (!item) continue;
    const itemGroupIds: string[] = Array.isArray(item.modifierGroupIds)
      ? (item.modifierGroupIds as string[])
      : [];
    const picked: string[] = Array.isArray((line as Record<string, unknown>).modifierIds)
      ? ((line as Record<string, unknown>).modifierIds as string[])
      : [];
    for (const gid of itemGroupIds) {
      const g = byGroup.get(gid);
      if (!g || g.isActive === false) continue;
      const count = picked.filter((mid) => modGroupOf.get(mid) === gid).length;
      const min = Number(g.minSelection ?? 0);
      const max = Number(g.maxSelection ?? 99);
      const iname = String(item.name ?? "Item");
      if (count < min)
        throw new Error(`${iname} needs at least ${min} from ${String(g.name)} (has ${count})`);
      if (count > max)
        throw new Error(`${iname} allows at most ${max} from ${String(g.name)} (has ${count})`);
    }
  }
  const outletId = opts.outletId ?? (String(found.row.outletId) || null);
  if (!outletId) throw new Error("Order has no outlet");
  // Station validation when supplied.
  if (opts.stationIds && opts.stationIds.length > 0) {
    const { outletKitchenStations } = await import("@pixa/db");
    const rows = (await db()
      .select({ id: outletKitchenStations.id })
      .from(outletKitchenStations)
      .where(
        and(
          eq(outletKitchenStations.organizationId, organizationId),
          inArray(outletKitchenStations.id, opts.stationIds),
        ),
      )) as unknown as Record<string, unknown>[];
    const foundIds = new Set(rows.map((r) => String(r.id)));
    const missing = opts.stationIds.filter((s) => !foundIds.has(s));
    if (missing.length > 0) throw new Error(`Unknown stationIds: ${missing.join(", ")}`);
  }
  const siblingCount = (
    (await db()
      .select({ id: kots.id })
      .from(kots)
      .where(and(eq(kots.organizationId, organizationId), eq(kots.orderId, orderId)))) as unknown[]
  ).length;
  const kotNumber = siblingCount + 1;
  const now = new Date();
  const kotId = ulid();
  const dbLines = draftLines.map((line, idx) => ({
    id: ulid(),
    organizationId,
    outletId,
    kotId,
    orderLineId: String(line.id),
    qty: Number(line.qty),
    voidedQty: 0,
    returnedQty: 0,
    status: "PENDING" as const,
    itemNameSnapshot: String(line.itemNameSnapshot ?? ""),
    variantNameSnapshot: (line.variantNameSnapshot as string | null) ?? null,
    modifiersSnapshot: (line.modifiersSnapshot as string[] | null) ?? [],
    instructions: (line.instructions as string | null) ?? null,
    createdAt: now,
    updatedAt: now,
  }));
  await db().insert(kotLines).values(dbLines);
  const [ticket] = await db()
    .insert(kots)
    .values({
      id: kotId,
      organizationId,
      outletId,
      orderId,
      kotNumber,
      status: "NEW",
      orderNumberSnapshot: String(found.row.orderNumber ?? ""),
      tableNumberSnapshot: (found.row.tableNumberSnapshot as string | null) ?? null,
      channel: String(found.row.channel ?? "dine_in"),
      stationIds: opts.stationIds ?? null,
      firedBy: opts.by ?? "staff",
      firedAt: now,
      voids: [],
      returns: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    })
    .returning();
  await recordServerEvent({
    outlet_id: outletId,
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: orderId,
    event_type: "ORDER_SENT_TO_KITCHEN",
    to_state: "IN_KITCHEN",
    actor_id: opts.by ?? "staff",
    metadata: { kot_id: kotId, kot_number: kotNumber, lines: dbLines.length },
  });
  const marks = dbLines.map((l) => ({
    line_id: String(l.orderLineId),
    kot_id: kotId,
    kot_line_id: l.id,
  }));
  try {
    const { markLinesFired } = await import("@/features/orders/api/server");
    const order = await markLinesFired(organizationId, orderId, marks, {
      actorId: opts.by ?? "staff",
    });
    // Post-fire verification: every targeted line must carry this ticket's
    // id — otherwise the bill would show items as draft AND in the KOT.
    const re = (await import("@/features/orders/api/server")).getOrderById;
    const reloaded = await re(organizationId, orderId);
    const unmarked = (reloaded?.items ?? []).filter(
      (i) => marks.some((m) => m.line_id === i.id) && i.kot_id !== kotId,
    );
    if (unmarked.length > 0) {
      throw new Error(
        `Fire incomplete — ${unmarked.length} line${unmarked.length === 1 ? "" : "s"} not marked. Retry firing.`,
      );
    }
    const t = toClientTicket(
      ticket as unknown as Record<string, unknown>,
      dbLines.map((l) => toClientLine(l as unknown as Record<string, unknown>)),
      [],
      [],
    );
    return { ticket: enrichTicket(t), order };
  } catch (e) {
    // Roll back the unpublished ticket so a failed fire never leaves a
    // phantom KOT behind the draft lines.
    await db()
      .delete(kotLines)
      .where(and(eq(kotLines.organizationId, organizationId), eq(kotLines.kotId, kotId)));
    await db()
      .delete(kots)
      .where(and(eq(kots.organizationId, organizationId), eq(kots.id, kotId)));
    throw e;
  }
}

export async function addAndFireItem(
  organizationId: string,
  orderId: string,
  input: {
    menu_item_id: string;
    variant_id?: string;
    modifier_ids?: string[];
    qty?: number;
    instructions?: string;
  },
  opts: { by?: string; outletId?: string | null },
): Promise<KitchenTicketWithDerived> {
  const { addOrderItem } = await import("@/features/orders/api/server");
  await addOrderItem(organizationId, orderId, input, {
    outletId: opts.outletId ?? null,
    actorId: opts.by,
  });
  const fired = await fireKOT(organizationId, orderId, { by: opts.by, outletId: opts.outletId });
  const t = await getTicketById(organizationId, fired.ticket.id);
  if (!t) throw new Error("KOT not found after firing");
  return t;
}

export async function addManyAndFire(
  organizationId: string,
  orderId: string,
  inputs: {
    menu_item_id: string;
    variant_id?: string;
    modifier_ids?: string[];
    qty?: number;
    instructions?: string;
  }[],
  opts: { by?: string; outletId?: string | null },
): Promise<KitchenTicketWithDerived> {
  if (inputs.length === 0) throw new Error("Nothing to fire");
  const { addOrderItem } = await import("@/features/orders/api/server");
  for (const input of inputs) {
    await addOrderItem(organizationId, orderId, input, {
      outletId: opts.outletId ?? null,
      actorId: opts.by,
    });
  }
  const fired = await fireKOT(organizationId, orderId, { by: opts.by, outletId: opts.outletId });
  const t = await getTicketById(organizationId, fired.ticket.id);
  if (!t) throw new Error("KOT not found after firing");
  return t;
}

/* ---------------- shared mutation helper ---------------- */

async function withTicket<T>(
  organizationId: string,
  id: string,
  fn: (row: Record<string, unknown>, lines: Record<string, unknown>[]) => Promise<T>,
): Promise<{ result: T; ticket: KitchenTicketWithDerived }> {
  const found = await loadTicket(organizationId, id);
  if (!found) throw new Error("KOT not found");
  const out = await fn(found.row, found.lines);
  await db()
    .update(kots)
    .set({ updatedAt: new Date() })
    .where(and(eq(kots.organizationId, organizationId), eq(kots.id, id)));
  const t = await getTicketById(organizationId, id);
  if (!t) throw new Error("KOT not found");
  return { result: out, ticket: t };
}

async function setLineFields(
  organizationId: string,
  lineId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const mapped: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.status !== undefined) mapped.status = patch.status;
  if (patch.qty !== undefined) mapped.qty = patch.qty;
  if ((patch as Record<string, unknown>).voided_qty !== undefined)
    mapped.voidedQty = (patch as Record<string, unknown>).voided_qty;
  if ((patch as Record<string, unknown>).voidedQty !== undefined)
    mapped.voidedQty = (patch as Record<string, unknown>).voidedQty;
  if ((patch as Record<string, unknown>).returned_qty !== undefined)
    mapped.returnedQty = (patch as Record<string, unknown>).returned_qty;
  if ((patch as Record<string, unknown>).returnedQty !== undefined)
    mapped.returnedQty = (patch as Record<string, unknown>).returnedQty;
  if (patch.instructions !== undefined) mapped.instructions = patch.instructions;
  await db()
    .update(kotLines)
    .set(mapped)
    .where(and(eq(kotLines.organizationId, organizationId), eq(kotLines.id, lineId)));
}

async function transitionTicket(
  organizationId: string,
  id: string,
  to: "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED",
  ctx: {
    actorId?: string;
    event_type?: string;
    reason_text?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const found = await loadTicket(organizationId, id);
  if (!found) throw new Error("KOT not found");
  const from = String(found.row.status);
  if (from === to) return;
  const allowed: Record<string, string[]> = {
    NEW: ["ACCEPTED", "CANCELLED"],
    ACCEPTED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["SERVED", "CANCELLED"],
    SERVED: [],
    CANCELLED: [],
  };
  if (!(allowed[from] ?? []).includes(to))
    throw new Error(`Illegal KOT transition ${from} → ${to}`);
  await db()
    .update(kots)
    .set({ status: to, updatedAt: new Date(), version: Number(found.row.version ?? 1) + 1 })
    .where(and(eq(kots.organizationId, organizationId), eq(kots.id, id)));
  await recordServerEvent({
    outlet_id: String(found.row.outletId),
    organization_id: organizationId,
    entity_type: "ORDER",
    entity_id: String(found.row.orderId),
    event_type: ctx.event_type ?? "KITCHEN_TICKET_UPDATED",
    from_state: from,
    to_state: to,
    actor_id: ctx.actorId,
    reason_text: ctx.reason_text,
    metadata: { kot_id: id, ...(ctx.metadata ?? {}) },
  });
}

/* ---------------- ticket-level transitions ---------------- */

export async function acceptKOT(
  organizationId: string,
  id: string,
  ctx: { by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row) => {
    if (String(row.status) === "ACCEPTED") return;
    if (String(row.status) !== "NEW")
      throw new Error(
        `Only NEW tickets can be accepted (KOT is ${String(row.status).toLowerCase()})`,
      );
    await transitionTicket(organizationId, id, "ACCEPTED", {
      actorId: ctx.by ?? "kitchen",
      event_type: "KITCHEN_STARTED",
    });
    const { advanceOrderForKitchen } = await import("@/features/orders/api/server");
    await advanceOrderForKitchen(organizationId, String(row.orderId));
  });
  return ticket;
}

export async function startPreparingKOT(
  organizationId: string,
  id: string,
  ctx: { by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row, lines) => {
    if (String(row.status) === "PREPARING") return;
    if (String(row.status) === "NEW") throw new Error("Accept the KOT before preparing");
    if (String(row.status) !== "ACCEPTED")
      throw new Error(`Cannot prepare a ${String(row.status).toLowerCase()} KOT`);
    await transitionTicket(organizationId, id, "PREPARING", { actorId: ctx.by ?? "kitchen" });
    for (const l of lines) {
      const s = String(l.status);
      if (s === "PENDING" || s === "ACCEPTED") {
        await setLineFields(organizationId, String(l.id), { status: "PREPARING" });
      }
    }
    const { advanceOrderForKitchen } = await import("@/features/orders/api/server");
    await advanceOrderForKitchen(organizationId, String(row.orderId));
  });
  return ticket;
}

async function setLineStatus(
  organizationId: string,
  lineId: string,
  to: string,
  line: Record<string, unknown>,
): Promise<void> {
  void line;
  await db()
    .update(kotLines)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(kotLines.organizationId, organizationId), eq(kotLines.id, lineId)));
}

export async function acceptKOTLine(
  organizationId: string,
  id: string,
  lineId: string,
  ctx: { by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row, lines) => {
    if (String(row.status) === "SERVED" || String(row.status) === "CANCELLED")
      throw new Error(`Cannot accept an item on a ${String(row.status).toLowerCase()} KOT`);
    const li = lines.findIndex((l) => String(l.id) === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = lines[li];
    if (String(line.status) === "ACCEPTED") return;
    if (String(line.status) !== "PENDING")
      throw new Error(
        `Only pending items can be accepted (item is ${String(line.status).toLowerCase()})`,
      );
    assertLineTransition(
      line.status as "PENDING",
      "ACCEPTED",
      String(line.itemNameSnapshot ?? "item"),
    );
    await setLineFields(organizationId, String(line.id), { status: "ACCEPTED" });
    await recordServerEvent({
      outlet_id: String(row.outletId),
      organization_id: organizationId,
      entity_type: "ORDER",
      entity_id: String(row.orderId),
      event_type: "KITCHEN_TICKET_UPDATED",
      from_state: "PENDING",
      to_state: "ACCEPTED",
      actor_id: ctx.by ?? "kitchen",
      metadata: { kot_id: id, kot_line_id: lineId },
    });
    if (String(row.status) === "NEW") {
      await transitionTicket(organizationId, id, "ACCEPTED", {
        actorId: ctx.by ?? "kitchen",
        event_type: "KITCHEN_STARTED",
      });
    }
    const { advanceOrderForKitchen } = await import("@/features/orders/api/server");
    await advanceOrderForKitchen(organizationId, String(row.orderId));
  });
  return ticket;
}

export async function startPreparingKOTLine(
  organizationId: string,
  id: string,
  lineId: string,
  ctx: { by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row, lines) => {
    const st = String(row.status);
    if (st === "NEW") throw new Error("Accept the KOT before starting items");
    if (st === "READY" || st === "SERVED" || st === "CANCELLED")
      throw new Error(`Cannot start an item on a ${st.toLowerCase()} KOT`);
    const li = lines.findIndex((l) => String(l.id) === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = lines[li];
    if (String(line.status) === "PREPARING") return;
    if (["VOIDED", "SERVED", "READY"].includes(String(line.status)))
      throw new Error(`Cannot start a ${String(line.status).toLowerCase()} item`);
    assertLineTransition(
      line.status as KOTLineStatus,
      "PREPARING",
      String(line.itemNameSnapshot ?? "item"),
    );
    await setLineFields(organizationId, String(line.id), { status: "PREPARING" });
    if (st === "ACCEPTED") {
      await transitionTicket(organizationId, id, "PREPARING", { actorId: ctx.by ?? "kitchen" });
    }
    const { advanceOrderForKitchen } = await import("@/features/orders/api/server");
    await advanceOrderForKitchen(organizationId, String(row.orderId));
  });
  return ticket;
}

export async function markLineReady(
  organizationId: string,
  id: string,
  lineId: string,
  ctx: { by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row, lines) => {
    const li = lines.findIndex((l) => String(l.id) === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = lines[li];
    if (String(line.status) === "READY") return;
    if (String(line.status) === "VOIDED" || String(line.status) === "SERVED")
      throw new Error(`A ${String(line.status).toLowerCase()} line cannot be marked ready`);
    if (String(line.status) !== "PREPARING")
      throw new Error(
        `Start preparing "${String(line.itemNameSnapshot ?? "item")}" before marking it ready`,
      );
    await setLineFields(organizationId, String(line.id), { status: "READY" });
    await recordServerEvent({
      outlet_id: String(row.outletId),
      organization_id: organizationId,
      entity_type: "ORDER",
      entity_id: String(row.orderId),
      event_type: "KITCHEN_ITEM_READY",
      actor_id: ctx.by ?? "kitchen",
      metadata: { kot_id: id, kot_line_id: lineId },
    });
    const remaining = (await db()
      .select()
      .from(kotLines)
      .where(
        and(eq(kotLines.organizationId, organizationId), eq(kotLines.kotId, id)),
      )) as unknown as Record<string, any>[];
    const all = remaining.map((l) => String(l.status));
    if (all.every((s) => s === "READY" || s === "VOIDED" || s === "SERVED")) {
      const cur = String(
        (
          await db()
            .select()
            .from(kots)
            .where(and(eq(kots.organizationId, organizationId), eq(kots.id, id)))
            .limit(1)
        )[0]?.status,
      );
      if (cur === "ACCEPTED") {
        await transitionTicket(organizationId, id, "PREPARING", { actorId: ctx.by ?? "kitchen" });
      }
      const cur2 = (
        await db()
          .select()
          .from(kots)
          .where(and(eq(kots.organizationId, organizationId), eq(kots.id, id)))
          .limit(1)
      )[0] as Record<string, unknown> | undefined;
      if (cur2 && String(cur2.status) === "PREPARING") {
        await transitionTicket(organizationId, id, "READY", { actorId: ctx.by });
      } else if (cur2 && String(cur2.status) !== "READY") {
        throw new Error(`Cannot ready a ${String(cur2.status).toLowerCase()} KOT`);
      }
    }
    const { advanceOrderForKitchen } = await import("@/features/orders/api/server");
    await advanceOrderForKitchen(organizationId, String(row.orderId));
  });
  return ticket;
}

export async function serveKOT(
  organizationId: string,
  id: string,
  ctx: { by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row, lines) => {
    if (String(row.status) !== "READY") throw new Error("Only READY tickets can be served");
    const notReady = lines.filter((l) =>
      ["PENDING", "ACCEPTED", "PREPARING"].includes(String(l.status)),
    );
    if (notReady.length > 0) {
      throw new Error(
        `${notReady.length} item${notReady.length === 1 ? " is" : "s are"} not ready yet — ${notReady.map((l) => String((l as Record<string, unknown>).itemNameSnapshot ?? "item")).join(", ")}`,
      );
    }
    for (const l of lines) {
      if (String(l.status) === "READY") {
        await setLineFields(organizationId, String(l.id), { status: "SERVED" });
      }
    }
    await transitionTicket(organizationId, id, "SERVED", { actorId: ctx.by ?? "staff" });
    const { advanceOrderForKitchen } = await import("@/features/orders/api/server");
    await advanceOrderForKitchen(organizationId, String(row.orderId));
  });
  return ticket;
}

export async function serveOpenTickets(
  organizationId: string,
  orderId: string,
  ctx: { by?: string } = {},
): Promise<number> {
  const tickets = (await db()
    .select()
    .from(kots)
    .where(
      and(eq(kots.organizationId, organizationId), eq(kots.orderId, orderId)),
    )) as unknown as Record<string, unknown>[];
  const open = tickets.filter((t) => !["SERVED", "CANCELLED"].includes(String(t.status)));
  let count = 0;
  for (const t of open) {
    const lines = (await db()
      .select()
      .from(kotLines)
      .where(
        and(eq(kotLines.organizationId, organizationId), eq(kotLines.kotId, String(t.id))),
      )) as unknown as Record<string, unknown>[];
    const live = lines.filter((l) => String(l.status) !== "VOIDED");
    if (live.length === 0) continue;
    for (const l of live) {
      if (String(l.status) !== "VOIDED" && String(l.status) !== "SERVED") {
        await setLineFields(organizationId, String(l.id), { status: "SERVED" });
      }
    }
    const cur = String(
      (
        await db()
          .select()
          .from(kots)
          .where(and(eq(kots.organizationId, organizationId), eq(kots.id, String(t.id))))
          .limit(1)
      )[0]?.status,
    );
    if (cur !== "SERVED" && cur !== "CANCELLED") {
      await db()
        .update(kots)
        .set({ status: "SERVED", updatedAt: new Date() })
        .where(and(eq(kots.organizationId, organizationId), eq(kots.id, String(t.id))));
      await recordServerEvent({
        outlet_id: String(t.outletId),
        organization_id: organizationId,
        entity_type: "ORDER",
        entity_id: orderId,
        event_type: "KITCHEN_TICKET_UPDATED",
        from_state: cur,
        to_state: "SERVED",
        actor_id: ctx.by ?? "staff",
        metadata: { completion_serve: true, kot_id: String(t.id), lines: live.length },
      });
    }
    count++;
  }
  if (count > 0) {
    const { advanceOrderForKitchen } = await import("@/features/orders/api/server");
    await advanceOrderForKitchen(organizationId, orderId);
  }
  return count;
}

export async function increaseKOTLineQty(
  organizationId: string,
  id: string,
  lineId: string,
  extra: number,
  ctx: { by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row, lines) => {
    if (String(row.status) === "SERVED" || String(row.status) === "CANCELLED")
      throw new Error(`Cannot change a line on a ${String(row.status).toLowerCase()} KOT`);
    const li = lines.findIndex((l) => String(l.id) === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = lines[li];
    if (["VOIDED", "SERVED", "READY"].includes(String(line.status)))
      throw new Error(`Cannot add qty to a ${String(line.status).toLowerCase()} line`);
    if (!Number.isInteger(extra) || extra < 1 || extra > 50)
      throw new Error("Extra qty must be between 1 and 50");
    await db()
      .update(kotLines)
      .set({ qty: Number(line.qty) + extra, updatedAt: new Date() })
      .where(and(eq(kotLines.organizationId, organizationId), eq(kotLines.id, lineId)));
    // Keep the order line in sync so the bill stays right (local parity).
    const { setOrderLineQty } = await import("@/features/orders/api/server");
    await setOrderLineQty(
      organizationId,
      String(row.orderId),
      String(line.orderLineId),
      Number(line.qty) + extra,
    );
    await recordServerEvent({
      outlet_id: String(row.outletId),
      organization_id: organizationId,
      entity_type: "ORDER",
      entity_id: String(row.orderId),
      event_type: "KOT_LINE_QTY_ADDED",
      actor_id: ctx.by ?? "staff",
      metadata: { kot_id: id, kot_line_id: lineId, extra },
    });
  });
  return ticket;
}

/* Voids keep the ticket row (red-marked); wasted quantities are computed by
 * the caller from PREPARING/READY lines. No inventory service exists
 * server-side yet, so wastage is noted in the event metadata. */
export async function voidKOT(
  organizationId: string,
  id: string,
  params: { reason: string; by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row, lines) => {
    if (!params.reason?.trim()) throw new Error("A reason is required to void a KOT");
    if (String(row.status) === "SERVED") throw new Error("A served KOT cannot be voided");
    if (String(row.status) === "CANCELLED") return null as unknown as void;
    const active = lines.filter((l) => String(l.status) !== "VOIDED");
    const now = new Date();
    for (const l of active) {
      await db()
        .update(kotLines)
        .set({ status: "VOIDED", voidedQty: Number(l.qty), updatedAt: now })
        .where(and(eq(kotLines.organizationId, organizationId), eq(kotLines.id, String(l.id))));
    }
    const voidEntry = {
      id: `void_${Date.now().toString(36)}`,
      qty: active.reduce((s, l) => s + (Number(l.qty) - Number(l.voidedQty ?? 0)), 0),
      reason: params.reason.trim(),
      voided_by: params.by ?? "staff",
      created_at: now.toISOString(),
    };
    await db()
      .update(kots)
      .set({
        voids: [
          ...((Array.isArray(row.voids) ? row.voids : []) as Record<string, unknown>[]),
          voidEntry,
        ],
        updatedAt: now,
      })
      .where(and(eq(kots.organizationId, organizationId), eq(kots.id, id)));
    await transitionTicket(organizationId, id, "CANCELLED", {
      actorId: params.by ?? "staff",
      reason_text: params.reason.trim(),
      event_type: "KOT_VOIDED",
    });
    const { advanceOrderForKitchen } = await import("@/features/orders/api/server");
    await advanceOrderForKitchen(organizationId, String(row.orderId));
  });
  return ticket;
}

export async function voidKOTLine(
  organizationId: string,
  id: string,
  lineId: string,
  params: { qty?: number; reason: string; by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row, lines) => {
    if (!params.reason?.trim()) throw new Error("A reason is required to void an item");
    if (String(row.status) === "SERVED" || String(row.status) === "CANCELLED")
      throw new Error(`Cannot void a line on a ${String(row.status).toLowerCase()} KOT`);
    const li = lines.findIndex((l) => String(l.id) === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = lines[li];
    if (String(line.status) === "VOIDED") return;
    if (String(line.status) === "SERVED") throw new Error("A served line cannot be voided");
    const remaining = Number(line.qty) - Number(line.voidedQty ?? 0);
    const qty = params.qty ?? remaining;
    if (!Number.isInteger(qty) || qty < 1 || qty > remaining)
      throw new Error(`Void qty must be between 1 and ${remaining}`);
    const newVoided = Number(line.voidedQty ?? 0) + qty;
    await setLineFields(organizationId, String(line.id), {
      ...(qty >= remaining
        ? { status: "VOIDED" as const, voided_qty: Number(line.qty) }
        : { voided_qty: newVoided }),
    });
    const now = new Date().toISOString();
    const voids = Array.isArray(row.voids) ? (row.voids as Record<string, unknown>[]) : [];
    await db()
      .update(kots)
      .set({
        voids: [
          ...voids,
          {
            id: `void_${Date.now().toString(36)}`,
            kot_line_id: lineId,
            qty,
            reason: params.reason.trim(),
            voided_by: params.by ?? "staff",
            created_at: now,
          },
        ],
        updatedAt: new Date(),
      })
      .where(and(eq(kots.organizationId, organizationId), eq(kots.id, id)));
    await recordServerEvent({
      outlet_id: String(row.outletId),
      organization_id: organizationId,
      entity_type: "ORDER",
      entity_id: String(row.orderId),
      event_type: "KOT_LINE_VOIDED",
      actor_id: params.by ?? "staff",
      reason_text: params.reason.trim(),
      metadata: { kot_id: id, kot_line_id: lineId, qty },
    });
    const { advanceOrderForKitchen } = await import("@/features/orders/api/server");
    await advanceOrderForKitchen(organizationId, String(row.orderId));
  });
  return ticket;
}

export async function returnKOTLine(
  organizationId: string,
  id: string,
  lineId: string,
  params: { qty: number; amount_paise: number; reason: string; by?: string },
): Promise<KitchenTicketWithDerived> {
  const { ticket } = await withTicket(organizationId, id, async (row, lines) => {
    if (!params.reason?.trim()) throw new Error("A reason is required to return an item");
    if (String(row.status) === "CANCELLED") throw new Error("Cannot return from a cancelled KOT");
    const li = lines.findIndex((l) => String(l.id) === lineId);
    if (li === -1) throw new Error("KOT line not found");
    const line = lines[li];
    const returnable =
      Number(line.qty) -
      Number(line.voidedQty ?? 0) -
      Number((line as Record<string, unknown>).returnedQty ?? 0);
    if (returnable <= 0) throw new Error("Nothing returnable left on this line");
    if (!Number.isInteger(params.qty) || params.qty < 1 || params.qty > returnable)
      throw new Error(`Return qty must be between 1 and ${returnable}`);
    if (!Number.isInteger(params.amount_paise) || params.amount_paise < 0)
      throw new Error("Return amount must be a non-negative paise integer");
    await db()
      .update(kotLines)
      .set({
        returnedQty: Number(line.returnedQty ?? 0) + params.qty,
        updatedAt: new Date(),
      })
      .where(and(eq(kotLines.organizationId, organizationId), eq(kotLines.id, lineId)));
    const returns = Array.isArray(row.returns) ? (row.returns as Record<string, unknown>[]) : [];
    await db()
      .update(kots)
      .set({
        returns: [
          ...returns,
          {
            id: `ret_${Date.now().toString(36)}`,
            kot_line_id: lineId,
            order_line_id: String((line as Record<string, unknown>).orderLineId ?? ""),
            qty: params.qty,
            amount_paise: params.amount_paise,
            reason: params.reason.trim(),
            returned_by: params.by ?? "staff",
            created_at: new Date().toISOString(),
          },
        ],
        updatedAt: new Date(),
      })
      .where(and(eq(kots.organizationId, organizationId), eq(kots.id, id)));
    await recordServerEvent({
      outlet_id: String(row.outletId),
      organization_id: organizationId,
      entity_type: "ORDER",
      entity_id: String(row.orderId),
      event_type: "KOT_LINE_RETURNED",
      actor_id: params.by ?? "staff",
      reason_text: params.reason.trim(),
      metadata: {
        kot_id: id,
        kot_line_id: lineId,
        qty: params.qty,
        amount_paise: params.amount_paise,
      },
    });
  });
  return ticket;
}
