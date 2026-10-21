// Notifications about the citizen's own report, from the browser side. The tracking key is
// kept on this device only (IndexedDB "kosova-follows"), so a tapped notification can open
// the report; the service worker reads the same store. Nothing secret travels in a push.
const DB = "kosova-follows";
const STORE = "keys";

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function keys(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request?.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export const rememberKey = (publicId, key) => keys("readwrite", (store) => store.put(key, publicId)).catch(() => {});
export const forgetKey = (publicId) => keys("readwrite", (store) => store.delete(publicId)).catch(() => {});
const knownKey = (publicId) => keys("readonly", (store) => store.get(publicId)).catch(() => null);

let serverKey;
async function publicKey() {
  if (serverKey === undefined)
    serverKey = await fetch("/api/push/key")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data?.publicKey || null)
      .catch(() => null);
  return serverKey;
}
const toBytes = (base64) =>
  Uint8Array.from(atob(base64.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

// unsupported | install-first (iPhone outside the installed app) | default | denied | following
export async function pushState(publicId, installed) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !(await publicKey())) return "unsupported";
  if (!("PushManager" in window) || !("Notification" in window))
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !installed ? "install-first" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription && (await knownKey(publicId))) return "following";
  }
  return "default";
}

// Call from a tap: browsers, and iOS always, refuse a permission prompt that isn't one.
export async function followReport({ publicId, trackingKey, locale }) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "default";
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(await publicKey()) }));
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, publicId, trackingKey, locale }),
  });
  if (!response.ok) throw new Error("subscribe");
  await rememberKey(publicId, trackingKey);
  return "following";
}

// Off for this device: the server forgets the subscription and every report it followed.
export async function stopNotifications() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
  await keys("readwrite", (store) => store.clear()).catch(() => {});
  return "default";
}
