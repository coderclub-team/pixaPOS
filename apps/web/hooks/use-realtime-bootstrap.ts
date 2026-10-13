"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { outletsQueryOptions, resolveActiveOutlet } from "@/features/outlet/api/queries";
import { deviceId } from "@/lib/db/device";
import { useRealtime, type RealtimeState } from "@/lib/realtime/use-realtime";
import type { TerminalType } from "@/lib/realtime/types";

type Opts = {
  terminalType: TerminalType;
  stationIds?: string[];
  enabled?: boolean;
  onEvent?: (payload: { id: number; event: unknown }) => void;
};

export function useRealtimeBootstrap(opts: Opts): {
  state: RealtimeState;
  lastSequence: number;
  outletId: string;
  deviceIdStr: string;
} {
  const { data: outlets } = useQuery(outletsQueryOptions);
  const outletId = resolveActiveOutlet(outlets ?? []);
  const [deviceIdStr] = useState(() => {
    try {
      return deviceId();
    } catch {
      return "";
    }
  });

  const { state, lastSequence } = useRealtime({
    outletId,
    deviceId: deviceIdStr || undefined,
    terminalType: opts.terminalType,
    stationIds: opts.stationIds,
    enabled: opts.enabled ?? !!outletId,
    onEvent: opts.onEvent,
  });

  // Register/refresh device on mount — fire-and-forget, never blocks render
  useEffect(() => {
    if (!outletId || !deviceIdStr) return;
    void fetch(`/api/devices/register?outletId=${encodeURIComponent(outletId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: deviceIdStr,
        terminalType: opts.terminalType,
        name: `${opts.terminalType} ${deviceIdStr.slice(-4)}`,
      }),
      credentials: "include",
    }).catch(() => {});
  }, [outletId, deviceIdStr, opts.terminalType]);

  return { state, lastSequence, outletId, deviceIdStr };
}
