import { TableStatus, OccupancyGroup, TableBlock, ReservationHold, RestaurantTable } from "./types";

/**
 * Validates a transition between table statuses.
 * Follows workflows.md §5: AVAILABLE -> OCCUPIED -> CLEANING -> AVAILABLE
 */
export const TABLE_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  available: ["occupied", "reserved", "out_of_service"],
  // occupied → available is the release-with-open-order edge only (order and
  // KOTs live on independently). Direct writes stay rejected in setTableStatus.
  occupied: ["cleaning", "out_of_service", "available"],
  cleaning: ["available", "out_of_service"],
  reserved: ["occupied", "available", "out_of_service"],
  out_of_service: ["available"],
};

export function canTransition(from: TableStatus, to: TableStatus): boolean {
  return TABLE_TRANSITIONS[from].includes(to);
}

/**
 * Shared-table party identity. Each active occupancy group gets a short label
 * (A, B, C… then A1, B1…) and a colour from a fixed palette so parties are
 * recognisable at a glance on the floor canvas and bill panel.
 */
const PARTY_PALETTE = [
  { chip: "fill-emerald-500", ring: "stroke-emerald-700", soft: "fill-emerald-100" },
  { chip: "fill-sky-500", ring: "stroke-sky-700", soft: "fill-sky-100" },
  { chip: "fill-violet-500", ring: "stroke-violet-700", soft: "fill-violet-100" },
  { chip: "fill-amber-500", ring: "stroke-amber-700", soft: "fill-amber-100" },
  { chip: "fill-rose-500", ring: "stroke-rose-700", soft: "fill-rose-100" },
  { chip: "fill-cyan-500", ring: "stroke-cyan-700", soft: "fill-cyan-100" },
  { chip: "fill-lime-500", ring: "stroke-lime-700", soft: "fill-lime-100" },
  { chip: "fill-fuchsia-500", ring: "stroke-fuchsia-700", soft: "fill-fuchsia-100" },
] as const;

export function partyColor(index: number): (typeof PARTY_PALETTE)[number] {
  return PARTY_PALETTE[
    ((index % PARTY_PALETTE.length) + PARTY_PALETTE.length) % PARTY_PALETTE.length
  ];
}

/** Hex twin of the palette for DOM surfaces (dots, chips) outside SVG. */
const PARTY_HEX = [
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#06b6d4",
  "#84cc16",
  "#d946ef",
] as const;

export function partyHex(index: number): string {
  return PARTY_HEX[((index % PARTY_HEX.length) + PARTY_HEX.length) % PARTY_HEX.length];
}

export function nextPartyLabel(siblingLabels: (string | undefined)[]): string {
  const taken = new Set(siblingLabels.filter(Boolean) as string[]);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (const ch of letters) if (!taken.has(ch)) return ch;
  let n = 1;
  while (taken.has(`A${n}`)) n++;
  return `A${n}`;
}

/**
 * Derived helper to get current seating and status for a table.
 * Implements logic from Design Ruling C1.
 */
export function deriveTableInfo(
  table: RestaurantTable,
  activeGroups: OccupancyGroup[],
  activeBlock?: TableBlock,
  activeHold?: ReservationHold,
) {
  const seatedSeats = activeGroups.reduce((sum, g) => sum + g.seats, 0);

  let occupancyFill: "EMPTY" | "PARTIAL" | "FULL" = "EMPTY";
  if (seatedSeats > 0) {
    occupancyFill = seatedSeats >= table.capacity ? "FULL" : "PARTIAL";
  }

  return {
    seatedSeats,
    occupancyFill,
    isBlocked: !!activeBlock || table.status === "out_of_service",
    isReserved: !!activeHold && activeGroups.length === 0,
  };
}
