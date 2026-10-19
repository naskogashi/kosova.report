"use client";
import { useSyncExternalStore } from "react";

// Captures the browser's install prompt as early as possible and shares it with every install button.
let deferred = null;
let installed = false;
let snapshot = { canPrompt: false, installed: false, ios: false };
const listeners = new Set();

function update() {
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  installed =
    installed ||
    matchMedia("(display-mode: standalone)").matches ||
    Boolean(navigator.standalone);
  const canPrompt = Boolean(deferred);
  // A new object only when something changed, or useSyncExternalStore re-renders forever.
  if (
    snapshot.canPrompt === canPrompt &&
    snapshot.installed === installed &&
    snapshot.ios === ios
  )
    return;
  snapshot = { canPrompt, installed, ios };
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    update();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    update();
  });
}

const server = { canPrompt: false, installed: true, ios: false };
export function useInstall() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      update();
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => server,
  );
}

export async function promptInstall() {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const choice = await event.userChoice.catch(() => null);
  if (choice?.outcome === "accepted") installed = true;
  update();
  return true;
}

export const openInstall = () =>
  window.dispatchEvent(new Event("kr:open-install"));
export const openCookies = () =>
  window.dispatchEvent(new Event("kr:open-cookies"));
