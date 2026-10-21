/*
 * kosova.report service worker.
 * Caches only public things: hashed build files, fonts, icons, the street map,
 * the report flow pages, municipal boundaries and the list of municipalities. It never caches
 * tracking pages, department links, the staff panel, submissions, PDFs or photos.
 * It also shows push notifications about the citizen's own report (see the end of this file).
 */
const VERSION = "v5";
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

// Push notifications about the citizen's own report. A notification carries only a short
// text and the report's path; the private key stays in this device's IndexedDB
// ("kosova-follows", written by src/lib/push-client.js) and is added to the #fragment here.
const SAFE_PATH = /^\/(sq|sr|en)\/(gjurmo|prati|track)\/[A-Z0-9]{2,10}-\d{4}-\d{6,12}$/;

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {}
  // Every push must show something, even one that can't be read.
  event.waitUntil(
    self.registration.showNotification(data.title || "kosova.report", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: data.lang,
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { path: SAFE_PATH.test(data.path || "") ? data.path : "/", publicId: data.publicId },
    }),
  );
});

function storedKey(publicId) {
  return new Promise((resolve) => {
    if (!publicId) return resolve(null);
    const request = indexedDB.open("kosova-follows", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys");
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("keys").objectStore("keys").get(publicId);
      read.onsuccess = () => {
        db.close();
        resolve(typeof read.result === "string" ? read.result : null);
      };
      read.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { path = "/", publicId } = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const target = new URL(path, self.location.origin);
      const key = await storedKey(publicId);
      if (key) target.hash = `key=${encodeURIComponent(key)}`;
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).pathname === target.pathname);
      if (open) {
        await open.navigate(target.href).catch(() => {});
        return open.focus();
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});

// The browser replaced the subscription: subscribe again and tell the server which one it replaces.
self.addEventListener("pushsubscriptionchange", (event) =>
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      if (!old?.options?.applicationServerKey) return;
      const subscription = event.newSubscription || (await self.registration.pushManager.subscribe(old.options));
      await fetch("/api/push/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old: old.toJSON(), subscription: subscription.toJSON() }),
      });
    })(),
  ),
);
