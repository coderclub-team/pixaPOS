/**
 * One-shot durable-mirror hydration at app startup: if the local SQLite
 * mirror holds collection docs (written by earlier sessions), adopt them
 * into memory + localStorage before any screen reads. No-op when the
 * mirror is empty (fresh device, seeds stay). Safe to call repeatedly —
 * subsequent calls are cheap no-ops per domain flag.
 */
import { hydrateOrdersFromMirror } from "@/features/orders/api/service";
import { hydrateTicketsFromMirror } from "@/features/kitchen/api/service";
import { hydratePaymentsFromMirror } from "@/features/payments/api/service";
import { hydrateTablesFromMirror } from "@/features/table/api/service";
import { hydrateFloorsFromMirror } from "@/features/floor/api/service";
import { hydrateMenuFromMirror } from "@/features/menu/api/service";
import { hydrateInventoryFromMirror } from "@/features/inventory/api/service";
import { hydrateCustomersFromMirror } from "@/features/customers/api/service";

let done = false;

export async function ensureLocalMirror(): Promise<void> {
  if (done) return;
  done = true;
  await Promise.allSettled([
    hydrateOrdersFromMirror(),
    hydrateTicketsFromMirror(),
    hydratePaymentsFromMirror(),
    hydrateTablesFromMirror(),
    hydrateFloorsFromMirror(),
    hydrateMenuFromMirror(),
    hydrateInventoryFromMirror(),
    hydrateCustomersFromMirror(),
  ]);
}
