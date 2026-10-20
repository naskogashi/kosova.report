/*
 * kosova.report service worker.
 * Caches only public things: hashed build files, fonts, icons, the street map,
 * the report flow pages, municipal boundaries and the list of municipalities. It never caches
 * tracking pages, department links, the staff panel, submissions, PDFs or photos.
 */
const VERSION = "v4";
const STATIC = `kosova-static-${VERSION}`;
const PAGES = `kosova-pages-${VERSION}`;
const INSTALL_ASSETS = [
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/maps/prishtina.svg",
];
// The report flow in every language, so it opens without a connection.
const REPORT_PAGES = ["/sq/raporto", "/sr/prijavi", "/en/report"];
const NEVER = [/^\/api\/(?!report-options$)/, /^\/admin/, /\/(gjurmo|prati|track)\//, /\/municipality\//];

self.addEventListener("install", (event) =>
  event.waitUntil(
    Promise.all([
      caches.open(STATIC).then((cache) => cache.addAll(INSTALL_ASSETS)),
      caches.open(PAGES).then((cache) => Promise.allSettled(REPORT_PAGES.map((page) => cache.add(page)))),
    ]).then(() => self.skipWaiting()),
  ),
);

self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("kosova-") && ![STATIC, PAGES].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

const isReportPage = (path) => REPORT_PAGES.some((page) => path === page);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (NEVER.some((pattern) => pattern.test(url.pathname))) return;

  // Hashed build output and fixed public files never change under the same URL.
  if (url.pathname.startsWith("/_next/static/") || INSTALL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Report flow pages and the municipality list: network first, cache as fallback.
  if (isReportPage(url.pathname) || url.pathname === "/api/report-options" || url.pathname.startsWith("/boundaries/")) {
    event.respondWith(
      caches.open(PAGES).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(isReportPage(url.pathname) ? url.pathname : request, response.clone());
          return response;
        } catch {
          const cached = await cache.match(isReportPage(url.pathname) ? url.pathname : request);
          return cached || caches.match("/offline.html");
        }
      }),
    );
    return;
  }

  if (request.mode === "navigate")
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
});
