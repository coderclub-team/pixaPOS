"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { kitchenKeys } from "./queries";

type FeedState = "idle" | "live" | "fallback";

/**
 * KDS live feed: subscribes to the Neon kdsfeed SSE endpoint and invalidates
 * the board on every ticket event. The 5s poll stays mounted as the offline
 * fallback (and takes over if the stream drops) — see page refetchInterval.
 *
 * Env (Vercel or .env.local):
 *   NEXT_PUBLIC_KDS_FEED_URL    e.g. https://<branch>-kdsfeed.compute…neon.tech
 *   NEXT_PUBLIC_KDS_FEED_SECRET shared secret (sent as ?token=, EventSource
 *                               cannot set headers)
 */
export function useKitchenFeed() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<FeedState>("idle");
  const retry = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const source = useRef<EventSource | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_KDS_FEED_URL;
    const token = process.env.NEXT_PUBLIC_KDS_FEED_SECRET;
    if (!base || !token || typeof EventSource === "undefined") {
      setState("fallback");
      return;
    }
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        source.current?.close();
      } catch {
        /* noop */
      }
      const es = new EventSource(
        `${base.replace(/\/$/, "")}/stream?token=${encodeURIComponent(token)}`,
      );
      source.current = es;
      es.onopen = () => {
        retry.current = 0;
        setState("live");
      };
      const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: kitchenKeys.all });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      };
      es.onmessage = invalidate;
      es.addEventListener("kot", invalidate as EventListener);
      const schedule = () => {
        es.close();
        setState("fallback");
        if (closed) return;
        retry.current += 1;
        timer.current = setTimeout(connect, Math.min(1000 * 2 ** retry.current, 15000));
      };
      es.onerror = schedule;
    };

    connect();
    return () => {
      closed = true;
      if (timer.current) clearTimeout(timer.current);
      try {
        source.current?.close();
      } catch {
        /* noop */
      }
    };
  }, [queryClient]);

  return state;
}
