"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Sheet from "./Sheet";
import { btn } from "./ui";

const KEY = "kr-privacy-notice-v2";

// Shown on first visit without a backdrop, so the Report button stays reachable.
export default function CookieNotice() {
  const t = useTranslations("cookies");
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "necessary-only") setOpen(true);
    } catch {
      setOpen(true);
    }
    const show = () => {
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener("kr:open-cookies", show);
    return () => window.removeEventListener("kr:open-cookies", show);
  }, []);
  function acknowledge() {
    try {
      localStorage.setItem(KEY, "necessary-only");
    } catch {}
    setOpen(false);
    setDetails(false);
  }
  const rows = [
    ["essential", "essentialBody", t("always"), true],
    ["map", "mapBody", t("always"), true],
    ["offline", "offlineBody", t("always"), true],
    ["analytics", "analyticsBody", null, false],
  ];
  return (
    <Sheet
      open={open}
      onClose={acknowledge}
      title={t("title")}
      titleId="cookie-title"
      closeLabel={t("close")}
      modal={false}
    >
      <p className="mt-1 text-pencil">{t("intro")}</p>
      {details && (
        <ul className="mt-4 grid gap-2">
          {rows.map(([name, body, state, on]) => (
            <li key={name} className="rounded-md bg-wash p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">{t(name)}</span>
                <span
                  role="switch"
                  aria-checked={on}
                  aria-disabled="true"
                  aria-label={t(name)}
                  className={`relative inline-flex h-7 w-12 shrink-0 rounded-full ${on ? "bg-blue" : "bg-rule"}`}
                >
                  <span
                    className={`absolute top-1 size-5 rounded-full bg-card ${on ? "right-1" : "left-1"}`}
                  />
                </span>
              </div>
              <p className="mt-1.5 text-sm text-pencil">{t(body)}</p>
              {state && <p className="mt-1 text-xs font-bold text-blue">{state}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={acknowledge} className={btn.primary} autoFocus>
          {details ? t("save") : t("necessary")}
        </button>
        {!details && (
          <button
            type="button"
            onClick={() => setDetails(true)}
            aria-expanded={details}
            className={btn.soft}
          >
            {t("customise")}
          </button>
        )}
      </div>
    </Sheet>
  );
}
