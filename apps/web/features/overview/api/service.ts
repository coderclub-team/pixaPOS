/**
 * Owner overview read-model (Phase 1). One composite aggregation over the
 * orders + payments read-models so the dashboard issues a single query per
 * filter change. Pure derivation — no new entities.
 */
import { getOrders, itemSalesStats } from "@/features/orders/api/service";
import { getPayments } from "@/features/payments/api/service";
import type { OrderChannel, RestaurantOrder } from "@/features/orders/api/types";
import type { Payment } from "@/features/payments/api/types";
import {
  CHANNEL_LABELS,
  PAYMENT_LABELS,
  type ChannelStat,
  type OverviewData,
  type OverviewFilters,
  type OverviewItem,
  type OverviewKpis,
  type OverviewRecentOrder,
  type PaymentStat,
  type TrendPoint,
} from "./types";

const ALL_CHANNELS: OrderChannel[] = [
  "dine_in",
  "counter",
  "takeaway",
  "delivery",
  "zomato",
  "swiggy",
  "own_online",
];

const LIVE_STATUSES = new Set<RestaurantOrder["status"]>([
  "CONFIRMED",
  "IN_KITCHEN",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
]);

function isSale(o: RestaurantOrder): boolean {
  return o.status !== "CANCELLED" && o.status !== "DRAFT";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Resolve the selected range → [from, to] and the previous equal window. */
export function rangeBounds(range: OverviewFilters["range"], now = new Date()) {
  const to = now;
  let from: Date;
  if (range === "today") {
    from = startOfDay(now);
  } else if (range === "7d") {
    from = startOfDay(addDays(now, -6));
  } else {
    from = startOfDay(addDays(now, -29));
  }
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - spanMs);
  return { from, to, prevFrom, prevTo };
}

function inWindow(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function hourLabel(h: number): string {
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${suffix}`;
}

function buildTrend(
  range: OverviewFilters["range"],
  sales: RestaurantOrder[],
  from: Date,
  to: Date,
): TrendPoint[] {
  if (range === "today") {
    const buckets: TrendPoint[] = Array.from({ length: 24 }, (_, h) => ({
      label: hourLabel(h),
      net_paise: 0,
      orders: 0,
    }));
    for (const o of sales) {
      const t = new Date(o.created_at);
      if (t < from || t > to) continue;
      const b = buckets[t.getHours()];
      b.net_paise += o.grand_total_paise;
      b.orders += 1;
    }
    // Trim empty leading/trailing hours for a tight chart.
    const first = buckets.findIndex((b) => b.orders > 0);
    const last = buckets.length - 1 - [...buckets].reverse().findIndex((b) => b.orders > 0);
    return first === -1
      ? buckets.slice(8, 23)
      : buckets.slice(Math.max(0, first - 1), Math.min(23, last + 1));
  }

  const days: TrendPoint[] = [];
  const index = new Map<string, TrendPoint>();
  for (let d = startOfDay(from); d.getTime() <= to.getTime(); d = addDays(d, 1)) {
    const point: TrendPoint = { label: dayLabel(d), net_paise: 0, orders: 0 };
    days.push(point);
    index.set(startOfDay(d).toDateString(), point);
  }
  for (const o of sales) {
    const t = new Date(o.created_at);
    if (t < from || t > to) continue;
    const point = index.get(startOfDay(t).toDateString());
    if (!point) continue;
    point.net_paise += o.grand_total_paise;
    point.orders += 1;
  }
  return days;
}

export async function getOverviewData(filters: OverviewFilters): Promise<OverviewData> {
  const { range, channel, outlet_id } = filters;
  const { from, to, prevFrom, prevTo } = rangeBounds(range);

  const [orders, payments] = await Promise.all([
    getOrders({ channel, outlet_id }),
    getPayments({ outlet_id }),
  ]);

  const salesAll = orders.filter(isSale);
  const sales = salesAll.filter((o) => inWindow(o.created_at, from, to));
  const prevSales = salesAll.filter((o) => inWindow(o.created_at, prevFrom, prevTo));

  const revenue = sales.reduce((s, o) => s + o.grand_total_paise, 0);
  const prevRevenue = prevSales.reduce((s, o) => s + o.grand_total_paise, 0);
  const liveLive = salesAll.filter((o) => LIVE_STATUSES.has(o.status));
  const occupied = new Set(
    liveLive
      .filter((o) => o.channel === "dine_in" && o.table_number_snapshot)
      .map((o) => o.table_number_snapshot),
  );

  const kpis: OverviewKpis = {
    revenue_paise: revenue,
    orders: sales.length,
    avg_bill_paise: sales.length > 0 ? Math.round(revenue / sales.length) : 0,
    live_orders: liveLive.length,
    occupied_tables: occupied.size,
    revenue_delta_pct:
      prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null,
  };

  const trend = buildTrend(range, sales, from, to);

  const channels: ChannelStat[] = ALL_CHANNELS.map((c) => {
    const rows = sales.filter((o) => o.channel === c);
    return {
      channel: c,
      label: CHANNEL_LABELS[c],
      orders: rows.length,
      net_paise: rows.reduce((s, o) => s + o.grand_total_paise, 0),
    };
  }).filter((c) => c.orders > 0 || !channel);

  const paidInRange = payments.filter(
    (p: Payment) => p.status === "PAID" && inWindow(p.created_at, from, to),
  );
  const byMethod = new Map<Payment["method"], number>();
  for (const p of paidInRange)
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_paise);
  const paymentStats: PaymentStat[] = [...byMethod.entries()]
    .map(([method, amount_paise]) => ({ method, label: PAYMENT_LABELS[method], amount_paise }))
    .sort((a, b) => b.amount_paise - a.amount_paise);

  const recent: OverviewRecentOrder[] = sales.slice(0, 8).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    channel: o.channel,
    channel_label: CHANNEL_LABELS[o.channel],
    total_paise: o.grand_total_paise,
    status: o.status,
    created_at: o.created_at,
    table_number: o.table_number_snapshot,
    customer_name: o.customer_name,
  }));

  const itemStats = await itemSalesStats({
    from: from.toISOString(),
    to: to.toISOString(),
    channel,
  });
  const items: OverviewItem[] = itemStats.map((s) => ({
    menu_item_id: s.menu_item_id,
    name: s.variant_name ? `${s.name} · ${s.variant_name}` : s.name,
    qty: s.qty,
    net_paise: s.net_paise,
  }));
  const top_items = items.slice(0, 5);
  const slow_items = [...items].sort((a, b) => a.qty - b.qty).slice(0, 5);

  const outletIds = [...new Set(orders.map((o) => o.outlet_id))].filter(Boolean);
  const outlets = outletIds.map((id) => ({ id, label: id }));

  return {
    kpis,
    trend,
    channels,
    payments: paymentStats,
    recent,
    top_items,
    slow_items,
    outlets,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
