"use client";
import { useEffect } from "react";

// Inbox keyboard shortcuts: j / k open the next / previous report, / jumps to search.
// Ignored while typing in a field.
export default function AdminShortcuts() {
  useEffect(() => {
    function onKey(event) {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (target.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "/") {
        event.preventDefault();
        document.getElementById("admin-search")?.focus();
        return;
      }
      if (event.key !== "j" && event.key !== "k") return;
      const items = [...document.querySelectorAll("[data-inbox-item]")];
      if (!items.length) return;
      const current = items.findIndex((item) => item.getAttribute("aria-current") === "true");
      const next = event.key === "j" ? Math.min(items.length - 1, current + 1) : Math.max(0, current - 1);
      if (next !== current || current === -1) items[current === -1 ? 0 : next].click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
