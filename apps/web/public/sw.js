/**
 * pixaPOS KDS service worker — offline shell for the wallboard.
 *
 * Strategy (no build deps, plain JS):
 * - install: precache the /kds shell + icons + manifest.
 * - navigations to /kds (+ /dashboard/kitchen): cache-first, refresh in
 *   background (stale-while-revalidate) so airplane-mode reloads render.
 * - /api/*: network-first with cache fallback for GETs; mutations always hit
 *   network (local-first services own offline writes, never the cache).
 * - static chunks/_next: stale-while-revalidate.
 *
 * Version the cache name to roll updates; old caches are purged on activate.
 * Ticket data itself lives in localStorage/IndexedDB — the SW only caches
 * the app shell, so the board renders offline with live local data.
 */
const VERSION = "kds-v1";
const SHELL = ["/kds", "/icon.png", "/apple-icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .catch(() => {}),
  );
});

function isApi(url) {
  return url.pathname.startsWith("/api/");
}

function isShellNav(request, url) {
  return (
    request.mode === "navigate" &&
    (url.pathname === "/kds" || url.pathname.startsWith("/dashboard/kitchen"))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API reads: network first, cached fallback (mutations bypass — POST etc).
  if (isApi(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(VERSION)
            .then((c) => c.put(request, copy))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // KDS shell navigations: cache first, refresh in background.
  if (isShellNav(request, url)) {
    event.respondWith(
      caches.match("/kds").then((cached) => {
        const refresh = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches
              .open(VERSION)
              .then((c) => c.put("/kds", copy))
              .catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || refresh;
      }),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (url.pathname.startsWith("/_next/") || url.pathname.match(/\.(png|ico|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const refresh = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches
              .open(VERSION)
              .then((c) => c.put(request, copy))
              .catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || refresh;
      }),
    );
  }
});
