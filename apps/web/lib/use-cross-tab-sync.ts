"use client";

import { useEffect } from "react";
import { getQueryClient } from "@/lib/query-client";

/**
 * Cross-tab realtime for the localStorage-backed mocks. A `storage` event
 * fires in every tab except the writer, so each surface refetches its shared
 * state the moment another tab (KDS, terminal, orders) writes — the orders
 * list, order detail, kitchen board and terminal never disagree.
 */
const SHARED_KEYS = [
  "pixaOrders",
  "pixaKOTs",
  "pixaPayments",
  "pixaTables",
  "pixaEvents",
  "pixaBilling",
  "pixaLocalDbBump",
];

export function useCrossTabSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !SHARED_KEYS.some((k) => e.key!.startsWith(k))) return;
      const qc = getQueryClient();
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["kitchen"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
