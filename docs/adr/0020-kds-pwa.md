# ADR-0020: Standalone KDS wallboard (`/kds`) as an installable offline PWA

Date: 2026-09-20 · Status: accepted

## Context

The kitchen board lived only inside the dashboard shell (sidebar + header
chrome, desktop-oriented). Wall tablets need a full-screen, installable,
offline-tolerant display that opens straight to tickets.

## Decisions

1. **Shared board component.** The board (tabs, kanban/cards, TicketCard, all
   KOT mutations, feed + poll) moved from `app/dashboard/kitchen/page.tsx` to
   `features/kitchen/components/kds-board.tsx` (`compact` prop for wall
   density). Both routes render it — one code path, no fork.
2. **Standalone `/kds` route.** No dashboard shell: sticky mini-header (brand,
   offline/install status, Dashboard link), full-viewport board, wake-lock
   attempt for wall tablets, in-app Install button from `beforeinstallprompt`.
   Dashboard Kitchen keeps its page and links out ("Open wallboard", new tab).
3. **Custom service worker, no new deps** (`public/sw.js`, registered from
   `/kds` only): precached shell, stale-while-revalidate for `/kds` +
   static assets, network-first for API GETs, mutations always network.
   Ticket data lives in localStorage/IndexedDB — the SW caches the shell, so
   the board renders offline with live local data.
4. **Single manifest kept** (`start_url` stays `/dashboard/overview`, plus
   `scope`/`id`). Wall tablets open `/kds` once, then Add to Home Screen from
   there. Phone installs still land on overview.
5. **Limits:** offline covers shell + board; server sync paths fail gracefully
   via existing toasts. No background sync, no push notifications.

## Consequences

- `/kds` requires sign-in (Better Auth gate); wall tablets sign in once,
  session persists.
- SW version string (`kds-v1`) must bump when the shell caching strategy
  changes; old caches purge on activate.
