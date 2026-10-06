"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";

/** Viewport query hook (client-only; defaults to false during SSR/first paint). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/**
 * Uniform table paging:
 * - desktop (lg+) pages the rows with controls;
 * - mobile/tablet reveals rows in chunks as the user scrolls (no pager, no
 *   huge one-shot render), driven by a sentinel element.
 */
export function useResponsiveTableRows<T>(all: T[], pageSize = 10) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPage(1);
    setVisibleCount(pageSize);
  }, [all.length, pageSize]);

  useEffect(() => {
    if (isDesktop) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + pageSize, all.length));
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isDesktop, all.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const rows = isDesktop
    ? all.slice((page - 1) * pageSize, page * pageSize)
    : all.slice(0, visibleCount);

  return {
    rows,
    isDesktop,
    page,
    setPage,
    totalPages,
    total: all.length,
    sentinelRef,
    hasMore: !isDesktop && visibleCount < all.length,
  };
}

export function TablePagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages} · {total} row{total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <Icons.chevronLeft className="size-4" aria-hidden />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <Icons.chevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Sentinel rendered under the table on mobile/tablet; shows a spinner state. */
export function LoadMoreSentinel({
  sentinelRef,
  hasMore,
}: {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  hasMore: boolean;
}) {
  if (!hasMore) return null;
  return (
    <div
      ref={sentinelRef}
      className="flex items-center justify-center py-4 text-xs text-muted-foreground"
    >
      Scroll for more…
    </div>
  );
}
