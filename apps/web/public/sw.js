/**
 * pixaPOS offline shell — installable app shells for /pos, /kds, /kiosk, /qr.
 *
 * Strategy (no build deps, plain JS):
 * - install: precache the four app shells + icons + manifest.
 * - navigations to /pos, /kds, /kiosk, /qr, /kot (+ /dashboard/kitchen):
 *   cache first, refresh in background (stale-while-revalidate) so
 *   airplane-mode reloads render.
 * - /api/*: network first with cache fallback for GETs; mutations always hit
 *   network (local-first services own offline writes, never the cache).
 * - static chunks/_next: stale-while-revalidate.
 *
 * Cache-poisoning guard: only res.ok responses are ever stored. A failed
 * fetch (error page, 404 chunk) falls through to network and is never
 * served stale on the next load.
 *
 * Version the cache name to roll updates; old caches are purged on activate.
 * Ticket data itself lives in localStorage/IndexedDB — the SW only caches
 * the app shell, so boards render offline with live local data.
 *
 * NOTE: registration is skipped on localhost (see use-service-worker hook) —
 * dev servers recompile constantly and a caching SW turns every transient
 * 500 into a permanent-looking stall. Offline testing happens on preview
 * builds.
 */
const VERSION = "pwa-v4";
const SHELL = [
  "/pos",
  "/kds",
  "/kiosk",
  "/qr",
  "/kot",
  "/dispatch",
  "/rider",
  "/icon.png",
  "/apple-icon.png",
  "/manifest.webmanifest",
  "/pos/manifest.webmanifest",
  "/kds/manifest.webmanifest",
  "/kiosk/manifest.webmanifest",
  "/qr/manifest.webmanifest",
  "/dispatch/manifest.webmanifest",
  "/rider/manifest.webmanifest",
];

function putOk(cache, request, res) {
  if (!res || !res.ok) return res;
  const copy = res.clone();
  cache.put(request, copy).catch(() => {});
  return res;
}

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

// Poke from the page to check for a pending update (called on visibility).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isApi(url) {
  return url.pathname.startsWith("/api/");
}

function isShellNav(request, url) {
  return (
    request.mode === "navigate" &&
    (url.pathname === "/pos" ||
      url.pathname === "/kds" ||
      url.pathname === "/kiosk" ||
      url.pathname === "/qr" ||
      url.pathname === "/kot" ||
      url.pathname === "/dispatch" ||
      url.pathname.startsWith("/dispatch/") ||
      url.pathname === "/rider" ||
      url.pathname.startsWith("/dashboard/kitchen") ||
      url.pathname.startsWith("/dashboard"))
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
        .then((res) =>
          caches
            .open(VERSION)
            .then((c) => putOk(c, request, res))
            .catch(() => res),
        )
        .catch(() => caches.match(request)),
    );
    return;
  }

  // App shell navigations: cache first, refresh in background.
  if (isShellNav(request, url)) {
    const cacheKey = url.pathname;
    event.respondWith(
      caches.match(cacheKey).then((cached) => {
        const refresh = fetch(request)
          .then((res) =>
            caches
              .open(VERSION)
              .then((c) => putOk(c, cacheKey, res))
              .catch(() => res),
          )
          .catch(() => cached);
        return cached || refresh;
      }),
    );
    return;
  }

  // Static assets + manifests: stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.match(/\.(png|ico|svg|woff2?|webmanifest)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const refresh = fetch(request)
          .then((res) =>
            caches
              .open(VERSION)
              .then((c) => putOk(c, request, res))
              .catch(() => res),
          )
          .catch(() => cached);
        return cached || refresh;
      }),
    );
  }
});
