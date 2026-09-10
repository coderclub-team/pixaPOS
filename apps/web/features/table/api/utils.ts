import { TableStatus, OccupancyGroup, TableBlock, ReservationHold, RestaurantTable } from "./types";

/**
 * Validates a transition between table statuses.
 * Follows workflows.md §5: AVAILABLE -> OCCUPIED -> CLEANING -> AVAILABLE
 */
export const TABLE_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  available: ["occupied", "reserved", "out_of_service"],
  occupied: ["cleaning", "out_of_service"],
  cleaning: ["available", "out_of_service"],
  reserved: ["occupied", "available", "out_of_service"],
  out_of_service: ["available"],
};

export function canTransition(from: TableStatus, to: TableStatus): boolean {
  return TABLE_TRANSITIONS[from].includes(to);
}

/**
 * Derived helper to get current seating and status for a table.
 * Implements logic from Design Ruling C1.
 */
export function deriveTableInfo(
  table: RestaurantTable,
  activeGroups: OccupancyGroup[],
  activeBlock?: TableBlock,
  activeHold?: ReservationHold
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
