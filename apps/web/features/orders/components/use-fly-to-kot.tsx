"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Ghost = {
  id: number;
  label: string;
  from: { x: number; y: number; w: number };
  to: { x: number; y: number };
  moved: boolean;
};

const FLY_MS = 450;

/**
 * CSS-only FLIP fly-to-KOT: a ghost chip slips from the picked menu card
 * down to the KOT list bottom. No animation library. Honors
 * prefers-reduced-motion by skipping the flight entirely.
 */
export function useFlyToKot() {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const idRef = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const fly = useCallback((sourceRect: { x: number; y: number; width: number } | null, label: string) => {
    if (
      !sourceRect ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return null;
    }
    const target = document.querySelector("[data-kot-list-bottom]");
    if (!target) return null;
    const tr = target.getBoundingClientRect();
    const id = ++idRef.current;
    setGhost({
      id,
      label,
      from: { x: sourceRect.x, y: sourceRect.y, w: Math.min(sourceRect.width, 220) },
      to: { x: tr.x + tr.width / 2 - 60, y: tr.y - 12 },
      moved: false,
    });
    timers.current.push(
      window.setTimeout(() => {
        setGhost((g) => (g && g.id === id ? { ...g, moved: true } : g));
      }, 30),
    );
    timers.current.push(
      window.setTimeout(() => {
        setGhost((g) => (g && g.id === id ? null : g));
      }, FLY_MS + 120),
    );
    return id;
  }, []);

  const ghostNode = ghost ? (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[100] rounded-full border border-primary bg-background px-3 py-1.5 text-xs font-medium shadow-lg"
      style={{
        left: ghost.from.x,
        top: ghost.from.y,
        width: ghost.from.w,
        transform: ghost.moved
          ? `translate(${ghost.to.x - ghost.from.x}px, ${ghost.to.y - ghost.from.y}px) scale(0.6)`
          : "translate(0,0) scale(1)",
        opacity: ghost.moved ? 0.25 : 1,
        transition: `transform ${FLY_MS}ms cubic-bezier(0.3,0.7,0.3,1), opacity ${FLY_MS}ms ease-out`,
      }}
    >
      <span className="block truncate">{ghost.label}</span>
    </div>
  ) : null;

  return { fly, ghostNode };
}
