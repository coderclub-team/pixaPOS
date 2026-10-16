"use client";

import { useEffect, useRef } from "react";

function inViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
}

export default function ScrollReveal({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const elements = [...(containerRef.current?.querySelectorAll("[data-reveal]") ?? [])];

    if (!elements.length) return;

    // Content is visible by default (see globals.css). Only below-the-fold
    // elements are pre-hidden, so a dead observer or missing JS can never
    // leave content stuck invisible — worst case is no animation.
    if (!("IntersectionObserver" in window)) return;

    const hidden = elements.filter((el) => !inViewport(el));
    hidden.forEach((el) => el.classList.add("is-hidden"));
    if (!hidden.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove("is-hidden");
            observer.unobserve(entry.target);
          }
        });
      },
      // Any pixel intersecting reveals: tall elements (e.g. the compare
      // table) can never reach a fractional threshold on short viewports.
      // The bottom margin pre-reveals slightly before entering the viewport.
      { threshold: 0, rootMargin: "0px 0px 15% 0px" },
    );

    hidden.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef}>{children}</div>;
}
