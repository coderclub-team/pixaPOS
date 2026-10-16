"use client";

import { useEffect, useRef } from "react";
import type { TerminalType } from "@/lib/realtime/types";
import { toNotification, showNotification } from "@/lib/realtime/notify";
import { loadPrefs, posSourceEnabled } from "@/lib/realtime/prefs";
import { usePixaSound } from "@/hooks/use-pixa-sound";
import { useRealtimeBootstrap } from "@/hooks/use-realtime-bootstrap";
import type { RealtimeState } from "@/lib/realtime/use-realtime";

/**
 * Presentation layer: realtime event → toast + sound.
 * Subscribes via useRealtimeBootstrap (DB/SSE stay authoritative).
 * Respects per-terminal prefs; POS own orders never notify.
 */
export function usePixaNotifications(terminal: TerminalType): {
  state: RealtimeState;
  lastSequence: number;
  sound: ReturnType<typeof usePixaSound>;
} {
  const sound = usePixaSound();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const onEventRef = useRef((payload: { id: number; event: unknown }) => {
    handlePixaEvent(payload.event as Record<string, unknown>, terminal, {
      show: showNotification,
      play: (k) => soundRef.current.play(k),
    });
  });
  const { state, lastSequence } = useRealtimeBootstrap({
    terminalType: terminal,
    enabled: true,
    onEvent: (p) => onEventRef.current(p),
  });

  useEffect(() => {
    void state;
    void lastSequence;
  }, [state, lastSequence]);

  return { state, lastSequence, sound };
}

/** Handle a single polled/SSE event: toast + sound per prefs. Pure helper for tests. */
export function handlePixaEvent(
  ev: Record<string, unknown>,
  terminal: TerminalType,
  deps: {
    show: (n: Parameters<typeof showNotification>[0]) => void;
    play: (k: Parameters<ReturnType<typeof usePixaSound>["play"]>[0]) => void;
  },
): void {
  const prefs = loadPrefs();
  const n = toNotification(ev, terminal);
  if (!n) return;
  if (terminal === "POS") {
    const source = String(
      (ev as Record<string, unknown>).source_type ??
        (ev as Record<string, unknown>).sourceType ??
        "",
    );
    if (!posSourceEnabled(prefs, source)) return;
    if (!prefs.pos.sound) {
      showNotification({ ...n, sound: "none" });
      return;
    }
  }
  if (terminal === "KDS" && !prefs.kds.sound) {
    showNotification({ ...n, sound: "none" });
    return;
  }
  showNotification(n);
  deps.play(n.sound);
  void deps.show;
}
