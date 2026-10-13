"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TerminalType } from "./types";
import { shouldDeliverTo } from "./routing";

export type RealtimeState = "idle" | "connecting" | "live" | "reconnecting" | "offline" | "error";

type UseRealtimeOptions = {
  outletId: string;
  deviceId?: string;
  enabled?: boolean;
  terminalType?: TerminalType;
  stationIds?: string[];
  onEvent?: (payload: { id: number; event: unknown }) => void;
};

const STORAGE_PREFIX = "pixa:lastSeq:";

function storageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

function getLastSeq(outletId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(storageKey(outletId)) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function setLastSeq(outletId: string, seq: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(outletId), String(seq));
  } catch {
    /* ignore */
  }
}

/**
 * Provider-agnostic realtime hook.
 * - Polls missed events via GET /api/events?afterSequence=
 * - Opens SSE GET /api/events (Accept: text/event-stream) when available
 * - Falls back to polling when SSE unavailable
 * - Idempotent via lastSequence + seenIds
 */
export function useRealtime(options: UseRealtimeOptions) {
  const { outletId, deviceId, enabled = true, terminalType, stationIds, onEvent } = options;
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeState>("idle");
  const [lastSequence, setLastSequenceState] = useState<number>(() => getLastSeq(outletId));
  const seenIds = useRef<Set<string>>(new Set());
  const sourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeqRef = useRef<number>(lastSequence);

  useEffect(() => {
    lastSeqRef.current = lastSequence;
  }, [lastSequence]);

  const persistSeq = useCallback(
    (seq: number) => {
      if (seq > lastSeqRef.current) {
        lastSeqRef.current = seq;
        setLastSequenceState(seq);
        setLastSeq(outletId, seq);
      }
    },
    [outletId],
  );

  const isRelevant = useCallback(
    (ev: unknown): boolean => {
      if (!terminalType && (!stationIds || stationIds.length === 0)) return true;
      const rec = ev as Record<string, unknown>;
      const eventType = String(rec.event_type ?? rec.eventType ?? "");
      const sourceType = (rec.source_type ?? rec.sourceType) as string | undefined;
      const target = rec.target as
        | { terminalTypes?: TerminalType[]; stationIds?: string[] }
        | undefined;
      if (!eventType) return true;
      if (
        terminalType &&
        !shouldDeliverTo(
          { event_type: eventType, source_type: sourceType, target: target as never },
          terminalType,
        )
      )
        return false;
      if (stationIds && stationIds.length > 0) {
        const evStations = (rec.station_ids ?? rec.stationIds) as string[] | undefined;
        const targetStations = target?.stationIds;
        const stations = evStations ?? targetStations;
        if (stations && stations.length > 0) {
          // Deliver only if at least one station overlaps
          const overlap = stations.some((s: string) => stationIds.includes(s));
          if (!overlap) return false;
        }
      }
      return true;
    },
    [terminalType, stationIds],
  );

  const fetchMissed = useCallback(
    async (after: number) => {
      if (!outletId) return;
      try {
        const url = new URL("/api/events", window.location.origin);
        url.searchParams.set("outletId", outletId);
        url.searchParams.set("afterSequence", String(after));
        url.searchParams.set("limit", "100");
        if (deviceId) url.searchParams.set("deviceId", deviceId);
        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
          credentials: "include",
        });
        if (res.status === 401 || res.status === 403) {
          setState("error");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          events?: Array<{ id: string; sequence: number }>;
        };
        const events = data.events ?? [];
        const relevant = events.filter((ev) => isRelevant(ev));
        for (const ev of relevant) {
          const id = String(ev.id ?? "");
          if (id && seenIds.current.has(id)) continue;
          if (id) seenIds.current.add(id);
          const seq = Number((ev as unknown as Record<string, unknown>).sequence ?? 0);
          if (Number.isFinite(seq) && seq > 0) persistSeq(seq);
        }
        // Even if no relevant events, advance cursor to avoid re-fetching
        if (events.length > 0) {
          const maxSeq = Math.max(
            ...events.map((e) => Number((e as unknown as Record<string, unknown>).sequence ?? 0)),
          );
          if (Number.isFinite(maxSeq) && maxSeq > lastSeqRef.current) persistSeq(maxSeq);
        }
        if (relevant.length > 0) {
          queryClient.invalidateQueries();
          for (const ev of relevant)
            onEvent?.({
              id: Number((ev as unknown as Record<string, unknown>).sequence ?? 0),
              event: ev,
            });
        }
      } catch {
        /* ignore */
      }
    },
    [outletId, deviceId, persistSeq, queryClient, onEvent, isRelevant],
  );

  // Sync lastSequence from storage on outlet change
  useEffect(() => {
    const s = getLastSeq(outletId);
    setLastSequenceState(s);
    lastSeqRef.current = s;
    seenIds.current.clear();
  }, [outletId]);

  useEffect(() => {
    if (
      !enabled ||
      !outletId ||
      typeof window === "undefined" ||
      typeof EventSource === "undefined"
    ) {
      setState("offline");
      return;
    }
    let closed = false;

    const startPollFallback = () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        if (document.hidden) return;
        void fetchMissed(lastSeqRef.current);
      }, 5000);
    };

    const connect = () => {
      if (closed) return;
      setState(retryRef.current === 0 ? "connecting" : "reconnecting");
      try {
        sourceRef.current?.close();
      } catch {
        /* */
      }
      const url = new URL("/api/events", window.location.origin);
      url.searchParams.set("outletId", outletId);
      url.searchParams.set("afterSequence", String(lastSeqRef.current));
      url.searchParams.set("stream", "1");
      if (deviceId) url.searchParams.set("deviceId", deviceId);

      const es = new EventSource(url.toString());
      sourceRef.current = es;

      es.onopen = () => {
        retryRef.current = 0;
        setState("live");
        // On (re)connect, fetch any gap first
        void fetchMissed(lastSeqRef.current);
      };

      const handleMessage = (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data) as {
            id?: number;
            event?: { id?: string; sequence?: number } & Record<string, unknown>;
          };
          const payload = (parsed.event ?? parsed) as Record<string, unknown>;
          if (!isRelevant(payload)) {
            // Still advance sequence to avoid gaps
            const rawSeq = Number(parsed.id ?? payload.sequence ?? 0);
            if (Number.isFinite(rawSeq) && rawSeq > 0) persistSeq(rawSeq);
            return;
          }
          const seq = Number(parsed.id ?? payload.sequence ?? 0);
          const evtId = String(payload.id ?? "");
          if (evtId && seenIds.current.has(evtId)) return;
          if (evtId) seenIds.current.add(evtId);
          if (Number.isFinite(seq) && seq > 0) persistSeq(seq);
          queryClient.invalidateQueries();
          onEvent?.({ id: seq, event: payload });
        } catch {
          queryClient.invalidateQueries();
        }
      };

      es.onmessage = handleMessage;
      // Also listen to named events (event_type) — EventSource dispatches them separately
      const namedTypes = [
        "ORDER_CREATED",
        "ORDER_SENT_TO_KITCHEN",
        "KITCHEN_TICKET_UPDATED",
        "KOT_CREATED",
        "KITCHEN_STARTED",
        "KITCHEN_ITEM_READY",
        "ORDER_READY",
        "ORDER_SERVED",
        "PAYMENT_COMPLETED",
      ];
      for (const t of namedTypes) es.addEventListener(t, handleMessage as EventListener);

      es.onerror = () => {
        es.close();
        if (closed) return;
        setState("reconnecting");
        retryRef.current += 1;
        const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(connect, delay);
        // While reconnecting, poll for missed events
        void fetchMissed(lastSeqRef.current);
        startPollFallback();
      };
    };

    // Immediate missed fetch before SSE
    void fetchMissed(getLastSeq(outletId));
    connect();

    const onVisible = () => {
      if (!document.hidden) void fetchMissed(lastSeqRef.current);
    };
    const onOnline = () => {
      retryRef.current = 0;
      if (sourceRef.current?.readyState === EventSource.CLOSED) connect();
      void fetchMissed(lastSeqRef.current);
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onVisible);

    // Fallback poll if SSE never connects
    const fallbackTimeout = setTimeout(() => {
      if (sourceRef.current?.readyState !== EventSource.OPEN) startPollFallback();
    }, 3000);

    return () => {
      closed = true;
      clearTimeout(fallbackTimeout);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onVisible);
      try {
        sourceRef.current?.close();
      } catch {
        /* */
      }
    };
  }, [enabled, outletId, deviceId, fetchMissed, persistSeq, queryClient, onEvent, isRelevant]);

  const reconnect = useCallback(() => {
    retryRef.current = 0;
    try {
      sourceRef.current?.close();
    } catch {
      /* */
    }
    void fetchMissed(lastSeqRef.current);
  }, [fetchMissed]);

  return { state, lastSequence, reconnect, fetchMissed };
}
