"use client";

import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pixa/ui/base-ui/collapsible";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR } from "@/lib/money";
import { orderQueryOptions } from "@/features/orders/api/queries";
import { kotsByOrderQueryOptions } from "@/features/kitchen/api/queries";
import { eventsQueryOptions, orderEventsQueryOptions } from "@/features/events/api/queries";
import type { BusinessEvent } from "@/features/events/api/types";

const DOT: Record<string, string> = {
  info: "bg-sky-500",
  progress: "bg-amber-500",
  success: "bg-green-500",
  done: "bg-emerald-600",
  danger: "bg-red-500",
  money: "bg-emerald-500",
  muted: "bg-slate-400",
};

const KOT_BADGE: Record<string, string> = {
  NEW: "border-slate-500 text-slate-600",
  ACCEPTED: "border-sky-500 text-sky-600",
  PREPARING: "border-amber-500 text-amber-600",
  READY: "border-green-500 text-green-600",
  SERVED: "border-emerald-600 text-emerald-700",
  CANCELLED: "border-red-500 text-red-600",
};

const NODE_ICON: Record<keyof typeof DOT, ComponentType<{ className?: string }>> = {
  info: Icons.info,
  progress: Icons.kitchen,
  success: Icons.check,
  done: Icons.check,
  danger: Icons.trash,
  money: Icons.creditCard,
  muted: Icons.clock,
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Ctx = {
  kotNumber: (kotId?: string) => string;
  lineName: (kotId?: string, kotLineId?: string) => string;
  orderLineName: (lineId?: string) => string;
};

/** One-line human rendering per event type. Amounts are paise in metadata. */
function describe(
  e: BusinessEvent,
  ctx: Ctx,
): { title: string; detail?: string; tone: keyof typeof DOT } {
  const m = e.metadata ?? {};
  switch (e.event_type) {
    case "ORDER_CREATED":
      return {
        title: `Order created (${m.channel?.replace("_", " ") ?? "order"})`,
        detail: m.order_number,
        tone: "info",
      };
    case "ORDER_CONFIRMED":
      return { title: "Order confirmed", tone: "info" };
    case "ORDER_SENT_TO_KITCHEN":
      if (m.reopened_by_fire)
        return {
          title: "Reopened — new items fired on a settled order",
          detail: `${(m.kot_ids ?? []).length} new ticket(s)`,
          tone: "progress",
        };
      return {
        title: `Fired to kitchen${m.kot_number ? ` as KOT #${m.kot_number}` : ""}`,
        detail: m.lines != null ? `${m.lines} item(s)` : undefined,
        tone: "progress",
      };
    case "ORDER_UPDATED":
      return {
        title: `Order updated${e.to_state ? ` → ${e.to_state.toLowerCase().replace("_", " ")}` : ""}`,
        tone: "muted",
      };
    case "ITEM_ADDED":
      return { title: `Added ${m.qty ?? 1}× ${ctx.orderLineName(m.line_id)}`, tone: "info" };
    case "ITEM_MODIFIED":
      return { title: `Changed ${ctx.orderLineName(m.line_id)} to ${m.qty}`, tone: "muted" };
    case "ITEM_REMOVED":
      return { title: `Removed ${ctx.orderLineName(m.line_id)}`, tone: "muted" };
    case "KITCHEN_TICKET_UPDATED": {
      const k = m.kot_line_id ? ` · ${ctx.lineName(m.kot_id, m.kot_line_id)}` : "";
      const move =
        e.from_state && e.to_state
          ? `${e.from_state.toLowerCase()} → ${e.to_state.toLowerCase()}`
          : "updated";
      return { title: `${ctx.kotNumber(m.kot_id)} ${move}${k}`, tone: "progress" };
    }
    case "KITCHEN_STARTED":
      return {
        title: m.kot_id ? `${ctx.kotNumber(m.kot_id)} acknowledged by kitchen` : "Kitchen started",
        tone: "progress",
      };
    case "KITCHEN_ITEM_READY":
      return { title: `${ctx.lineName(m.kot_id, m.kot_line_id)} ready`, tone: "success" };
    case "ORDER_READY":
      return { title: "Order ready — every item done", tone: "success" };
    case "ORDER_SERVED":
      return { title: "Order served", tone: "done" };
    case "ORDER_COMPLETED":
      return { title: "Order completed", tone: "done" };
    case "ORDER_CANCELLED":
      return {
        title: `Order cancelled${e.from_state ? ` (was ${e.from_state.toLowerCase().replace("_", " ")})` : ""}`,
        detail: e.reason_text,
        tone: "danger",
      };
    case "KOT_VOIDED":
      return { title: `${ctx.kotNumber(m.kot_id)} voided`, detail: e.reason_text, tone: "danger" };
    case "KOT_LINE_VOIDED":
      return {
        title: `Voided ${m.qty ?? ""}× ${ctx.lineName(m.kot_id, m.kot_line_id)}`.trim(),
        detail: e.reason_text,
        tone: "danger",
      };
    case "KOT_LINE_QTY_ADDED":
      return {
        title: `+${m.extra}× ${ctx.lineName(m.kot_id, m.kot_line_id)} (kitchen makes more)`,
        tone: "info",
      };
    case "KOT_LINE_RETURNED":
      return {
        title: `Returned ${m.qty ?? ""}× ${ctx.lineName(m.kot_id, m.kot_line_id)}`.trim(),
        detail: e.reason_text,
        tone: "muted",
      };
    case "ITEM_RETURNED":
      return {
        title: `Items returned (${formatINR(m.total_paise ?? 0)})`,
        detail: e.reason_text,
        tone: "muted",
      };
    case "ORDER_CUSTOMER_LINKED":
      return { title: "Customer linked", tone: "info" };
    case "ORDER_CUSTOMER_UNLINKED":
      return { title: "Customer unlinked", detail: e.reason_text, tone: "muted" };
    case "ORDER_DISCOUNTED": {
      const d =
        m.percent != null
          ? `${m.percent}%`
          : m.amount_paise != null
            ? formatINR(m.amount_paise)
            : "";
      return { title: `Discount ${d}`, detail: e.reason_text, tone: "muted" };
    }
    case "ORDER_SPLIT_BUILT":
      return { title: `Split built (${m.mode}, ${m.partitions} shares)`, tone: "muted" };
    case "ORDER_SPLIT_EDITED":
      return { title: `Split edited (${m.mode}, ${m.partitions} shares)`, tone: "muted" };
    case "ORDER_SPLIT_CLEARED":
      return { title: "Split removed", detail: e.reason_text, tone: "muted" };
    case "ORDER_PAID":
      return { title: "Bill fully paid", tone: "money" };
    case "ORDER_LOCKED":
      return { title: "Order locked (table released)", detail: e.reason_text, tone: "muted" };
    case "PAYMENT_COMPLETED": {
      const method = String(m.method ?? "payment").replace("_", " ");
      const extra = [
        m.partition_label ? `· ${m.partition_label}` : "",
        m.change_paise ? `· change ${formatINR(m.change_paise)}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return {
        title: `Paid ${formatINR(m.amount_paise ?? 0)} via ${method} ${extra}`.trim(),
        tone: "money",
      };
    }
    case "REFUND_CREATED":
      return {
        title: `Refunded ${formatINR(m.amount_paise ?? 0)}`,
        detail: e.reason_text,
        tone: "danger",
      };
    default:
      return { title: e.event_type.toLowerCase().replace(/_/g, " "), tone: "muted" };
  }
}

/**
 * Order audit trail as a tree timeline: order spine with expandable KOT
 * branches (ticket → item leaves). Reads the persisted event stream
 * (ORDER scope + PAYMENT scope merged) joined with live snapshots for names.
 */
export default function OrderTimeline({ orderId }: { orderId: string }) {
  const { data: order } = useQuery(orderQueryOptions(orderId));
  const { data: kots } = useQuery(kotsByOrderQueryOptions(orderId));
  const { data: orderEvents } = useQuery(orderEventsQueryOptions(orderId));
  const { data: payEvents } = useQuery(eventsQueryOptions({ entity_type: "PAYMENT" }));
  const [open, setOpen] = useState<boolean | null>(null); // null = auto by status
  const [openKots, setOpenKots] = useState<Set<string>>(new Set());

  const kotById = new Map((kots ?? []).map((k) => [k.id, k]));
  const ctx: Ctx = {
    kotNumber: (kotId) => {
      const k = kotById.get(kotId ?? "");
      return k ? `KOT #${k.kot_number}` : "KOT";
    },
    lineName: (kotId, kotLineId) => {
      const kl = kotById.get(kotId ?? "")?.lines.find((l) => l.id === kotLineId);
      const ol = order?.items.find((i) => i.id === kl?.order_line_id);
      return ol?.item_name_snapshot ?? kl?.item_name_snapshot ?? "Item";
    },
    orderLineName: (lineId) =>
      order?.items.find((i) => i.id === lineId)?.item_name_snapshot ?? "Item",
  };

  const mine = (payEvents ?? []).filter((e) => e.metadata?.order_id === orderId);
  const all = [...(orderEvents ?? []), ...mine].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  const terminal = order?.status === "COMPLETED" || order?.status === "CANCELLED";
  const expanded = open ?? terminal ?? true;

  // Chronological nodes: KOT-scoped events collapse into one expandable
  // branch positioned at the ticket's first appearance; everything else
  // stays on the spine in time order.
  const byKot = new Map<string, BusinessEvent[]>();
  for (const e of all) {
    const kid = e.metadata?.kot_id as string | undefined;
    if (kid) {
      const list = byKot.get(kid) ?? [];
      list.push(e);
      byKot.set(kid, list);
    }
  }
  const seenKot = new Set<string>();
  const nodes: ({ kind: "event"; e: BusinessEvent } | { kind: "branch"; kotId: string })[] = [];
  for (const e of all) {
    const kid = e.metadata?.kot_id as string | undefined;
    if (kid) {
      if (!seenKot.has(kid)) {
        seenKot.add(kid);
        nodes.push({ kind: "branch", kotId: kid });
      }
    } else {
      nodes.push({ kind: "event", e });
    }
  }

  const toggleKot = (id: string) =>
    setOpenKots((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Card>
      <Collapsible open={expanded} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>History · {all.length}</span>
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label={expanded ? "Collapse history" : "Expand history"}
                />
              }
            >
              <Icons.chevronRight
                className={cn("size-4 transition-transform", expanded && "rotate-90")}
              />
            </CollapsibleTrigger>
          </CardTitle>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {all.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No history yet — actions on this order will appear here.
              </p>
            ) : (
              <ol>
                {(() => {
                  type Row = {
                    key: string;
                    date: string;
                    tone: keyof typeof DOT;
                    title: ReactNode;
                    detail?: string;
                    meta?: string;
                    badge?: ReactNode;
                    compact?: boolean;
                    onClick?: () => void;
                    chevron?: boolean;
                  };
                  const rows: Row[] = [];
                  const metaOf = (e: BusinessEvent, d: { title: string; detail?: string }) =>
                    `${e.actor_id ?? "System"}${e.reason_text && !d.detail ? ` · ${e.reason_text}` : ""}`;
                  for (const n of nodes) {
                    if (n.kind === "event") {
                      const d = describe(n.e, ctx);
                      rows.push({
                        key: n.e.id,
                        date: fmtTime(n.e.created_at),
                        tone: d.tone,
                        title: d.title,
                        detail: d.detail,
                        meta: metaOf(n.e, d),
                        badge:
                          n.e.from_state && n.e.to_state && n.e.from_state !== n.e.to_state ? (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {n.e.from_state.toLowerCase().replace("_", " ")} →{" "}
                              {n.e.to_state.toLowerCase().replace("_", " ")}
                            </Badge>
                          ) : undefined,
                      });
                      continue;
                    }
                    const events = byKot.get(n.kotId) ?? [];
                    const k = kotById.get(n.kotId);
                    const isOpen = openKots.has(n.kotId);
                    const ready =
                      k?.lines.filter((l) => l.status === "READY" || l.status === "SERVED")
                        .length ?? 0;
                    const total =
                      k?.lines.filter((l) => l.qty - l.voided_qty > 0).length ?? events.length;
                    const tone = k ? kotTone(k.status) : "muted";
                    rows.push({
                      key: n.kotId,
                      date: fmtTime(events[0]?.created_at ?? new Date().toISOString()),
                      tone,
                      title: ctx.kotNumber(n.kotId),
                      meta: `${ready}/${total} ready · ${events.length} event${events.length === 1 ? "" : "s"}`,
                      badge: k ? (
                        <Badge
                          variant="outline"
                          className={cn("shrink-0 text-[10px]", KOT_BADGE[k.status])}
                        >
                          {k.status.toLowerCase()}
                        </Badge>
                      ) : undefined,
                      onClick: () => toggleKot(n.kotId),
                      chevron: isOpen,
                    });
                    if (isOpen) {
                      for (const e of events) {
                        const d = describe(e, ctx);
                        rows.push({
                          key: e.id,
                          date: fmtTime(e.created_at),
                          tone: d.tone,
                          title: d.title,
                          detail: d.detail,
                          meta: metaOf(e, d),
                          compact: true,
                        });
                      }
                    }
                  }
                  return rows.map((r, i) => (
                    <TimelineRow
                      key={r.key}
                      date={r.date}
                      tone={r.tone}
                      title={r.title}
                      detail={r.detail}
                      meta={r.meta}
                      badge={r.badge}
                      compact={r.compact}
                      onClick={r.onClick}
                      chevron={r.chevron}
                      isFirst={i === 0}
                      isLast={i === rows.length - 1}
                    />
                  ));
                })()}
              </ol>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function kotTone(status: string): keyof typeof DOT {
  if (status === "READY") return "success";
  if (status === "SERVED") return "done";
  if (status === "CANCELLED") return "danger";
  if (status === "PREPARING" || status === "ACCEPTED") return "progress";
  return "muted";
}

/**
 * One timeline row: date-left | icon-node rail | content-right on md+,
 * collapsed left rail with date caption on mobile. Connector segments join
 * through the node cell (top half unless first, bottom half unless last).
 */
function TimelineRow({
  date,
  tone,
  title,
  detail,
  meta,
  badge,
  isFirst,
  isLast,
  compact,
  onClick,
  chevron,
}: {
  date: string;
  tone: keyof typeof DOT;
  title: ReactNode;
  detail?: string;
  meta?: string;
  badge?: ReactNode;
  isFirst: boolean;
  isLast: boolean;
  compact?: boolean;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const Icon = NODE_ICON[tone];
  const body = (
    <>
      <span className="mb-0.5 block text-[11px] text-muted-foreground md:hidden">{date}</span>
      <span className="flex items-center gap-1.5">
        <span className="block truncate text-sm font-medium">{title}</span>
        {chevron !== undefined && (
          <Icons.chevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              chevron && "rotate-90",
            )}
          />
        )}
      </span>
      {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {meta && <span>{meta}</span>}
        {badge}
      </span>
    </>
  );
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 md:grid-cols-[96px_40px_minmax(0,1fr)] md:gap-3">
      <span className="hidden pt-2 text-right text-xs text-muted-foreground md:block">{date}</span>
      <span className="relative flex justify-center">
        {!isFirst && (
          <span
            aria-hidden
            className={cn(
              "absolute left-1/2 w-px -translate-x-1/2 bg-border",
              compact ? "top-0 h-6" : "top-0 h-8",
            )}
          />
        )}
        <span
          className={cn(
            "z-10 flex shrink-0 items-center justify-center self-start rounded-full text-white",
            DOT[tone],
            compact ? "size-6" : "size-8",
          )}
        >
          <Icon className={compact ? "size-3" : "size-4"} />
        </span>
        {!isLast && (
          <span
            aria-hidden
            className={cn(
              "absolute left-1/2 w-px -translate-x-1/2 bg-border",
              compact ? "top-6 bottom-0" : "top-8 bottom-0",
            )}
          />
        )}
      </span>
      <span className={cn("min-w-0", isLast ? "pb-1" : "pb-6")}>
        {onClick ? (
          <button type="button" onClick={onClick} className="block w-full text-left">
            {body}
          </button>
        ) : (
          body
        )}
      </span>
    </li>
  );
}
