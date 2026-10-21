"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "./icons";
import { btn } from "./ui";
import { openInstall, useInstall } from "./install";
import { followReport, pushState, stopNotifications } from "../lib/push-client";

// "Tell me when the department responds": push notifications about this one report, on this
// device. Hidden where the browser can't do it or push isn't set up on the server.
export default function FollowReport({ publicId, trackingKey, className = "" }) {
  const t = useTranslations("follow");
  const locale = useLocale();
  const { installed } = useInstall();
  const [state, setState] = useState("loading");
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    pushState(publicId, installed)
      .then((value) => alive && setState(value))
      .catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, [publicId, installed]);

  if (state === "loading" || state === "unsupported" || !trackingKey) return null;

  async function turnOn() {
    setError(false);
    setState("working");
    try {
      setState(await followReport({ publicId, trackingKey, locale }));
    } catch {
      setError(true);
      setState("default");
    }
  }
  async function turnOff() {
    setState("working");
    try {
      setState(await stopNotifications());
    } catch {
      setState("following");
    }
  }

  return (
    <section aria-labelledby="follow-title" className={`rounded-lg bg-wash p-4 ${className}`}>
      <h2 id="follow-title" className="flex items-center gap-2 font-extrabold">
        <Icon name="phone" className="size-5 text-blue" />
        {t("title")}
      </h2>
      {state === "following" ? (
        <>
          <p className="mt-1 flex items-start gap-2 text-sm font-semibold" role="status">
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-blue" />
            {t("following")}
          </p>
          <button type="button" onClick={turnOff} className={`${btn.link} text-sm`}>
            {t("stop")}
          </button>
        </>
      ) : state === "install-first" ? (
        <>
          <p className="mt-1 text-sm">{t("installFirst")}</p>
          <button type="button" onClick={openInstall} className={`${btn.link} text-sm`}>
            {t("installAction")}
          </button>
        </>
      ) : state === "denied" ? (
        <p className="mt-1 text-sm">{t("denied")}</p>
      ) : (
        <>
          <p className="mt-1 text-sm">{t("body")}</p>
          <button type="button" onClick={turnOn} disabled={state === "working"} className={`${btn.primary} mt-3`}>
            {state === "working" ? t("working") : t("action")}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold text-error">
              {t("error")}
            </p>
          )}
        </>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs text-pencil">
        <Icon name="key" className="mt-0.5 size-3.5 shrink-0" />
        {t("privacy")}
      </p>
    </section>
  );
}
