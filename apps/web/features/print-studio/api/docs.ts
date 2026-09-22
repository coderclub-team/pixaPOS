/**
 * Pure print-document builders (Phase 1). Paise in, printable doc out.
 * Builders never touch printers, network, or stores — service.ts orchestrates.
 */
import { formatINR } from "@/lib/money";
import type { Outlet } from "@/features/outlet/api/types";
import type { BillingView } from "@/features/orders/api/types";
import type { Payment } from "@/features/payments/api/types";
import type { KitchenTicket } from "@/features/kitchen/api/types";
import type { PrintTemplate } from "./types";

export type DocLine =
  | {
      kind: "text";
      text: string;
      align?: "left" | "center" | "right";
      bold?: boolean;
      double?: boolean;
    }
  | { kind: "rule" }
  | { kind: "pair"; left: string; right: string; bold?: boolean }
  | { kind: "qr"; data: string; label?: string }
  | { kind: "feed"; lines: number };

export type PrintDoc = {
  lines: DocLine[];
  /** Stable hash of the doc — reprint identity + idempotency key. */
  hash: string;
};

function hashDoc(lines: DocLine[]): string {
  let h = 5381;
  const s = JSON.stringify(lines);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `doc_${(h >>> 0).toString(36)}`;
}

function headerLines(outlet: Outlet, template: PrintTemplate): DocLine[] {
  const lines: DocLine[] = [];
  for (const h of template.header_lines) {
    if (h.trim()) lines.push({ kind: "text", text: h.trim(), align: "center", bold: true });
  }
  if (template.show_outlet_address) {
    const addr = [outlet.address_line_1, outlet.locality, outlet.city, outlet.postal_code]
      .filter(Boolean)
      .join(", ");
    if (addr) lines.push({ kind: "text", text: addr, align: "center" });
    if (outlet.phone) lines.push({ kind: "text", text: `Ph: ${outlet.phone}`, align: "center" });
  }
  if (template.show_gstin && outlet.gstin) {
    lines.push({ kind: "text", text: `GSTIN: ${outlet.gstin}`, align: "center" });
  }
  if (template.show_fssai && outlet.fssai_number) {
    lines.push({ kind: "text", text: `FSSAI: ${outlet.fssai_number}`, align: "center" });
  }
  if (lines.length > 0) lines.push({ kind: "rule" });
  return lines;
}

function footerLines(template: PrintTemplate): DocLine[] {
  const lines: DocLine[] = [{ kind: "rule" }];
  for (const f of template.footer_lines) {
    if (f.trim()) lines.push({ kind: "text", text: f.trim(), align: "center" });
  }
  if (template.show_powered_by) {
    lines.push({ kind: "text", text: "Powered by pixaPOS", align: "center" });
  }
  return lines;
}

function stamp(dateISO: string): string {
  const d = new Date(dateISO);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function itemLabel(
  item: { item_name_snapshot: string; variant_name_snapshot?: string },
  qty: number,
): string {
  const name = item.variant_name_snapshot
    ? `${item.item_name_snapshot} (${item.variant_name_snapshot})`
    : item.item_name_snapshot;
  return `${qty} x ${name}`;
}

/** Customer bill. Returned lines are excluded from totals (already adjusted upstream). */
export function buildBillDoc(args: {
  billing: BillingView;
  payments: Payment[];
  outlet: Outlet;
  template: PrintTemplate;
  isDuplicate?: boolean;
  upiId?: string;
  trackingUrl?: string;
}): PrintDoc {
  const { billing, payments, outlet, template, isDuplicate, upiId, trackingUrl } = args;
  const order = billing.order;
  const lines: DocLine[] = [
    ...headerLines(outlet, template),
    {
      kind: "text",
      text: isDuplicate ? "*** DUPLICATE BILL ***" : "*** TAX INVOICE ***",
      align: "center",
      bold: true,
    },
    {
      kind: "text",
      text: `Bill: ${order.order_number}  ${order.table_number_snapshot ? `Tbl: ${order.table_number_snapshot}` : order.channel}`,
    },
    {
      kind: "text",
      text: `${stamp(order.created_at)}${order.customer_name ? `  ${order.customer_name}` : ""}`,
    },
    { kind: "rule" },
  ];
  for (const item of order.items) {
    const liveQty = item.qty - (item.returned_qty ?? 0);
    if (liveQty <= 0) continue;
    lines.push({
      kind: "pair",
      left: itemLabel(item, liveQty),
      right: formatINR(item.line_total_paise),
    });
    for (const mod of item.modifiers) {
      lines.push({
        kind: "pair",
        left: `  + ${mod.name_snapshot}`,
        right: formatINR(mod.price_paise),
      });
    }
    if (item.instructions) lines.push({ kind: "text", text: `  * ${item.instructions}` });
  }
  lines.push({ kind: "rule" });
  lines.push({ kind: "pair", left: "Subtotal", right: formatINR(order.subtotal_paise) });
  if ((order.discount_paise ?? 0) > 0) {
    lines.push({
      kind: "pair",
      left: `Discount${order.discount_reason ? ` (${order.discount_reason})` : ""}`,
      right: `-${formatINR(order.discount_paise ?? 0)}`,
    });
  }
  if (template.show_tax_breakup) {
    lines.push({ kind: "pair", left: "Tax", right: formatINR(order.tax_paise) });
  }
  lines.push({
    kind: "pair",
    left: "GRAND TOTAL",
    right: formatINR(order.grand_total_paise),
    bold: true,
  });
  if (template.show_payments && payments.length > 0) {
    lines.push({ kind: "rule" });
    for (const p of payments) {
      lines.push({
        kind: "pair",
        left: `${p.method}${p.partition_label ? ` (${p.partition_label})` : ""}`,
        right: formatINR(p.amount_paise),
      });
      if (p.tendered_paise != null) {
        lines.push({ kind: "pair", left: "  Tendered", right: formatINR(p.tendered_paise) });
        lines.push({ kind: "pair", left: "  Change", right: formatINR(p.change_paise ?? 0) });
      }
    }
    if (billing.balance_paise > 0) {
      lines.push({
        kind: "pair",
        left: "Balance due",
        right: formatINR(billing.balance_paise),
        bold: true,
      });
    }
  }
  if (template.qr === "UPI" && upiId) {
    lines.push({
      kind: "qr",
      data: `upi://pay?pa=${upiId}&pn=${encodeURIComponent(outlet.name)}&am=${(order.grand_total_paise / 100).toFixed(2)}&cu=INR`,
      label: "Scan to pay",
    });
  }
  if ((template.qr === "ORDER" || template.qr === "EINVOICE") && trackingUrl) {
    lines.push({ kind: "qr", data: trackingUrl, label: "Track order" });
  }
  lines.push(...footerLines(template));
  return { lines, hash: hashDoc(lines) };
}

/** Kitchen ticket — no prices, token-forward. Skips fully voided lines. */
export function buildKOTDoc(args: {
  ticket: KitchenTicket;
  outlet: Outlet;
  template: PrintTemplate;
  tokenNo?: string;
}): PrintDoc {
  const { ticket, outlet, template, tokenNo } = args;
  const lines: DocLine[] = [
    {
      kind: "text",
      text: `*** KOT #${ticket.kot_number} ***`,
      align: "center",
      bold: true,
      double: true,
    },
    {
      kind: "text",
      text: `Order: ${ticket.order_number_snapshot}${ticket.table_number_snapshot ? `  Tbl: ${ticket.table_number_snapshot}` : ""}`,
      align: "center",
      bold: true,
    },
    ...(tokenNo
      ? [
          {
            kind: "text" as const,
            text: `TOKEN: ${tokenNo}`,
            align: "center" as const,
            bold: true,
            double: true,
          },
        ]
      : []),
    { kind: "text", text: `${stamp(ticket.fired_at)}  ${ticket.channel}` },
    { kind: "rule" },
  ];
  for (const line of ticket.lines) {
    const liveQty = line.qty - line.voided_qty - line.returned_qty;
    if (liveQty <= 0) continue;
    const name = line.variant_name_snapshot
      ? `${line.item_name_snapshot} (${line.variant_name_snapshot})`
      : line.item_name_snapshot;
    lines.push({ kind: "text", text: `${liveQty} x ${name}`, bold: true });
    for (const mod of line.modifiers_snapshot) lines.push({ kind: "text", text: `  + ${mod}` });
    if (line.instructions)
      lines.push({ kind: "text", text: `  !! ${line.instructions}`, bold: true });
  }
  if (ticket.fired_by) lines.push({ kind: "text", text: `Fired by: ${ticket.fired_by}` });
  lines.push(...footerLines(template));
  return { lines, hash: hashDoc(lines) };
}

/** Takeaway token slip — big token number, no prices. */
export function buildTokenDoc(args: {
  orderNumber: string;
  tokenNo: string;
  outlet: Outlet;
  template: PrintTemplate;
  trackingUrl?: string;
  itemCount?: number;
}): PrintDoc {
  const { orderNumber, tokenNo, outlet, template, trackingUrl, itemCount } = args;
  const lines: DocLine[] = [
    ...headerLines(outlet, template),
    { kind: "text", text: "*** TAKEAWAY TOKEN ***", align: "center", bold: true },
    { kind: "text", text: tokenNo, align: "center", bold: true, double: true },
    {
      kind: "text",
      text: `Order: ${orderNumber}${itemCount != null ? `  Items: ${itemCount}` : ""}`,
      align: "center",
    },
  ];
  if (template.qr === "ORDER" && trackingUrl) {
    lines.push({ kind: "qr", data: trackingUrl, label: "Track order" });
  }
  lines.push(...footerLines(template));
  return { lines, hash: hashDoc(lines) };
}
