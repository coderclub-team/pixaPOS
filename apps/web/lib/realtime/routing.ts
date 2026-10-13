import type { TerminalType } from "./types";

export type RoutingRule = {
  eventType: string;
  source?: string;
  targets: TerminalType[];
};

const RULES: RoutingRule[] = [
  // ORDER_CREATED from POS → KDS
  { eventType: "ORDER_CREATED", source: "POS", targets: ["KDS"] },
  { eventType: "ORDER_CREATED", source: "QR", targets: ["POS", "KDS"] },
  { eventType: "ORDER_CREATED", source: "KIOSK", targets: ["POS", "KDS"] },
  { eventType: "ORDER_CREATED", source: "WEBSITE", targets: ["POS", "KDS"] },
  { eventType: "ORDER_CREATED", source: "CAPTAIN", targets: ["POS", "KDS"] },
  { eventType: "ORDER_CREATED", targets: ["POS", "KDS"] }, // fallback
  { eventType: "KITCHEN_TICKET_UPDATED", targets: ["KDS"] },
  { eventType: "KOT_CREATED", targets: ["KDS"] },
  { eventType: "ORDER_SENT_TO_KITCHEN", targets: ["KDS"] },
  { eventType: "KITCHEN_STARTED", source: "KDS", targets: ["POS", "CAPTAIN"] },
  { eventType: "KITCHEN_ITEM_READY", source: "KDS", targets: ["POS", "CAPTAIN"] },
  { eventType: "ORDER_READY", source: "KDS", targets: ["POS", "CAPTAIN"] },
  { eventType: "ORDER_SERVED", source: "KDS", targets: ["POS", "CAPTAIN"] },
  { eventType: "KOT_VOIDED", targets: ["POS", "KDS"] },
  { eventType: "PAYMENT_COMPLETED", targets: ["POS", "CAPTAIN"] },
  { eventType: "ORDER_STATUS_CHANGED", source: "KDS", targets: ["POS", "CAPTAIN"] },
];

export function resolveTargets(eventType: string, source?: string): TerminalType[] | undefined {
  const exact = RULES.find((r) => r.eventType === eventType && r.source === source);
  if (exact) return exact.targets;
  const generic = RULES.find((r) => r.eventType === eventType && !r.source);
  return generic?.targets;
}

export function shouldDeliverTo(
  event: {
    event_type: string;
    source_type?: string | null;
    target?: { terminalTypes?: TerminalType[] } | null;
  },
  terminalType: TerminalType,
): boolean {
  if (event.target?.terminalTypes && event.target.terminalTypes.length > 0) {
    return event.target.terminalTypes.includes(terminalType);
  }
  const targets = resolveTargets(event.event_type, event.source_type ?? undefined);
  if (!targets) return true; // no rule → deliver to all
  return targets.includes(terminalType);
}
