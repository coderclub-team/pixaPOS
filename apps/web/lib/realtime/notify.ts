"use client";

import { toast } from "sonner";
import type { TerminalType } from "./types";
import { shouldDeliverTo } from "./routing";

export type PixaNotification = {
  title: string;
  body?: string;
  level: "info" | "success" | "warning";
  sound: "kot" | "order" | "ready" | "payment" | "none";
};

type RawEvent = Record<string, unknown> & {
  event_type?: string;
  eventType?: string;
  source_type?: string;
  sourceType?: string;
  target?: { terminalTypes?: TerminalType[] };
  metadata?: Record<string, unknown>;
};

/**
 * Domain event → user notification (presentation layer only).
 * Never used for state — SSE/poll + DB remain authoritative.
 */
export function toNotification(ev: RawEvent, terminal: TerminalType): PixaNotification | null {
  const eventType = String(ev.event_type ?? ev.eventType ?? "");
  const source = String(ev.source_type ?? ev.sourceType ?? "SYSTEM");
  const meta = (ev.metadata ?? {}) as Record<string, unknown>;
  if (!eventType) return null;
  if (
    !shouldDeliverTo(
      { event_type: eventType, source_type: source, target: ev.target as never },
      terminal,
    )
  )
    return null;

  const orderNo = String(meta.order_number ?? meta.orderNumber ?? "");
  const kotNo = String(meta.kot_number ?? meta.kotNumber ?? "");
  const tableNo = String(meta.table_number ?? meta.tableNumber ?? "");
  const lines = Number(meta.lines ?? 0);

  switch (eventType) {
    case "ORDER_CREATED":
      if (terminal === "KDS") return null; // KDS listens for KOT, not order
      return {
        title:
          `New ${source === "QR" ? "QR" : source === "KIOSK" ? "Kiosk" : source === "WEBSITE" ? "Online" : source === "CAPTAIN" ? "Captain" : ""} Order${orderNo ? ` ${orderNo}` : ""}`
            .replace("  ", " ")
            .trim(),
        body: [tableNo ? `Table ${tableNo}` : null].filter(Boolean).join(" · ") || undefined,
        level: "info",
        sound: "order",
      };
    case "ORDER_SENT_TO_KITCHEN":
    case "KOT_CREATED":
      if (terminal !== "KDS") return null;
      return {
        title: `New KOT${kotNo ? ` #${kotNo}` : ""}${orderNo ? ` · ${orderNo}` : ""}`,
        body:
          [tableNo ? `Table ${tableNo}` : null, lines ? `${lines} items` : null]
            .filter(Boolean)
            .join(" · ") || undefined,
        level: "info",
        sound: "kot",
      };
    case "KITCHEN_TICKET_UPDATED":
      return null; // too noisy — only terminal transitions notify
    case "KITCHEN_STARTED":
      return terminal === "KDS"
        ? null
        : { title: "Kitchen started", body: orderNo || undefined, level: "info", sound: "none" };
    case "KITCHEN_ITEM_READY":
    case "ORDER_READY":
      return terminal === "KDS"
        ? null
        : {
            title: `Order ready${orderNo ? ` ${orderNo}` : ""}`,
            body: tableNo ? `Table ${tableNo}` : undefined,
            level: "success",
            sound: "ready",
          };
    case "ORDER_SERVED":
      return null;
    case "KOT_VOIDED":
    case "KOT_LINE_VOIDED":
      return {
        title: "KOT voided",
        body: orderNo || undefined,
        level: "warning",
        sound: "none",
      };
    case "PAYMENT_COMPLETED":
    case "ORDER_PAID":
      return terminal === "KDS"
        ? null
        : {
            title: `Payment collected${orderNo ? ` · ${orderNo}` : ""}`,
            level: "success",
            sound: "payment",
          };
    case "ORDER_CANCELLED":
      return {
        title: "Order cancelled",
        body: orderNo || undefined,
        level: "warning",
        sound: "none",
      };
    default:
      return null;
  }
}

export function showNotification(n: PixaNotification): void {
  const msg = n.body ? `${n.title} — ${n.body}` : n.title;
  if (n.level === "success") toast.success(msg);
  else if (n.level === "warning") toast.warning(msg);
  else toast.info(msg);
}
