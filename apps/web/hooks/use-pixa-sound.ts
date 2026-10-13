"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ne from "zod/v4/locales/ne.js";

export type SoundKind = "kot" | "order" | "ready" | "payment" | "none";

export type SoundSettings = {
  enabled: boolean;
  volume: number; // 0..1
  repeat: number; // 1..3
};

const KEY = "pixa:sound";

function load(): SoundSettings {
  if (typeof window === "undefined") return { enabled: true, volume: 0.7, repeat: 1 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { enabled: true, volume: 0.7, repeat: 1 };
    const p = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      enabled: p.enabled ?? true,
      volume: Math.min(1, Math.max(0, Number(p.volume ?? 0.7))),
      repeat: Math.min(3, Math.max(1, Math.round(Number(p.repeat ?? 1)))),
    };
  } catch {
    return { enabled: true, volume: 0.7, repeat: 1 };
  }
}

/**
 * WebAudio beep — no audio assets, works offline.
 * Browsers block audio until user gesture: call unlock() from an explicit
 * "Enable sound" button. play() before unlock is a no-op (never throws).
 */
export function usePixaSound() {
  const [settings, setSettings] = useState<SoundSettings>(() => load());
  const [unlocked, setUnlocked] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const unlock = useCallback(() => {
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      ctxRef.current ??= new AC();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      // silent blip to claim the gesture
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
      setUnlocked(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const play = useCallback(
    (kind: SoundKind) => {
      if (kind === "none" || !settings.enabled || !unlocked) return;
      try {
        const ctx = ctxRef.current;
        if (!ctx || ctx.state !== "running") return;
        const freq = kind === "kot" ? 880 : kind === "ready" ? 660 : kind === "payment" ? 520 : 740;
        for (let r = 0; r < settings.repeat; r++) {
          const t0 = ctx.currentTime + r * 0.35;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.01, settings.volume), t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.3);
        }
      } catch {
        /* never break the mutation path */
      }
    },
    [settings, unlocked],
  );

  return { settings, setSettings, unlocked, unlock, play };
}
