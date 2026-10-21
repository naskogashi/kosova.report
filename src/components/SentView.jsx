"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "../i18n/navigation";
import Receipt from "./Receipt";
import { Icon } from "./icons";
import { btn, wrap } from "./ui";
import { readReceipt } from "../lib/draft-store";
import { downloadReportPDF } from "../lib/report-pdf-client";
import { openInstall, useInstall } from "./install";
import FollowReport from "./FollowReport";

export default function SentView() {
  const t = useTranslations("sent");
  const ti = useTranslations("install");
  const router = useRouter();
  const { installed } = useInstall();
  const [receipt, setReceipt] = useState(undefined);
  const [skip, setSkip] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");
  const [pdf, setPdf] = useState("idle");
  const [warn, setWarn] = useState(false);
  useEffect(() => {
    const value = readReceipt();
    setReceipt(value);
    if (value) {
      try {
        sessionStorage.setItem(`kr-key:${value.public_id}`, value.tracking_key);
        navigator.vibrate?.([12, 60, 18]);
      } catch {}
    }
  }, []);
  // Leaving before the key is saved gets the browser's own confirmation.
  useEffect(() => {
    const guard = (event) => {
      if (receipt && !saved) event.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [receipt, saved]);

  if (receipt === undefined) return <div className="min-h-[70svh]" />;
  if (!receipt)
    return (
      <div className={`${wrap} py-16`}>
        <p className="max-w-[34rem] text-lg">{t("missing")}</p>
        <Link href="/track" className={`${btn.primary} mt-6`}>
          {t("missingAction")}
        </Link>
      </div>
    );

  async function copy(text, which) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  }
  const keyText = `${t("keyFileIntro")}\n\n${t("number")}: ${receipt.public_id}\n${t("keyTitle")}: ${receipt.tracking_key}\n\n${location.origin}`;
  function saveFile() {
    const url = URL.createObjectURL(new Blob([keyText], { type: "text/plain;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: `kosova-report-${receipt.public_id}.txt`,
    });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function shareKey() {
    try {
      await navigator.share({ title: `kosova.report ${receipt.public_id}`, text: keyText });
    } catch {}
  }
  async function getPDF() {
    setPdf("busy");
    try {
      await downloadReportPDF(receipt.public_id, receipt.tracking_key);
      setPdf("idle");
    } catch {
      setPdf("error");
    }
  }
  function leave(target) {
    if (!saved) {
      setWarn(true);
      document.getElementById("saved-check")?.focus();
      return;
    }
    router.push(target);
  }
  async function sharePlatform() {
    try {
      await navigator.share({ title: "kosova.report", text: t("shareText"), url: location.origin });
    } catch {}
  }
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className={`${wrap} grid gap-10 py-8 lg:grid-cols-[27.5rem_minmax(0,1fr)] lg:gap-16 lg:py-14`} data-skip={skip || undefined}>
      <div className="order-2 flex flex-col items-center gap-3 lg:order-1">
        <Receipt
          publicId={receipt.public_id}
          category={receipt.category}
          cityName={receipt.cityName}
          cityCode={receipt.city}
          position={receipt.position}
          description={receipt.description}
          photoCount={receipt.photoCount}
          anonymous={receipt.anonymous}
          submittedAt={receipt.submittedAt}
          stamped
          className="lg:rotate-[-1.5deg]"
          stub={
            <div className="stub-tear relative translate-y-3 rotate-1 rounded-b-lg border-t-2 border-dashed border-rule bg-card px-6 pt-5 pb-6">
              <span aria-hidden="true" className="absolute -top-2.5 -left-2.5 size-5 rounded-full bg-paper" />
              <span aria-hidden="true" className="absolute -top-2.5 -right-2.5 size-5 rounded-full bg-paper" />
              <p className="font-stamp text-xl font-black tracking-[0.06em] text-blue uppercase">{t("keyTitle")}</p>
              <p className="tabular mt-2 rounded-sm bg-wash px-3 py-2.5 text-lg font-bold break-all" translate="no">
                {receipt.tracking_key}
              </p>
            </div>
          }
        />
        <button type="button" onClick={() => setSkip(true)} className={`${btn.link} text-sm`} hidden={skip}>
          {t("skip")}
        </button>
      </div>

      <div className="order-1 min-w-0 lg:order-2">
        <h1 tabIndex={-1} className="text-4xl font-extrabold tracking-[-0.03em]">
          {t("heading")}
        </h1>
        <div className="mt-6">
          <p className="text-sm font-bold text-pencil">{t("number")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="tabular text-3xl font-extrabold tracking-[-0.01em]">{receipt.public_id}</p>
            <button type="button" onClick={() => copy(receipt.public_id, "id")} className={`${btn.soft} min-h-11 px-3 text-sm`}>
              <Icon name={copied === "id" ? "check" : "copy"} className="size-5" />
              {copied === "id" ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
        {receipt.notification === "pending" && (
          <p role="status" className="mt-4 rounded-md bg-wash p-3 text-sm font-semibold">
            {t("pending")}
          </p>
        )}
        {receipt.incident?.ref && (
          <section className="mt-6 flex items-start gap-3 rounded-lg bg-wash p-4">
            <Icon name="group" className="mt-0.5 size-6 shrink-0 text-blue" />
            <div>
              <p className="font-extrabold">
                {receipt.incident.joined
                  ? t("incidentJoined", { count: receipt.incident.report_count })
                  : t("incidentNew")}
              </p>
              <p className="mt-1 text-sm">{receipt.incident.joined ? t("incidentJoinedBody") : t("incidentNewBody")}</p>
              <button
                type="button"
                onClick={() => leave({ pathname: "/incident/[ref]", params: { ref: receipt.incident.ref } })}
                className={`${btn.link} text-sm`}
              >
                {t("incidentOpen")}
              </button>
            </div>
          </section>
        )}

        <FollowReport publicId={receipt.public_id} trackingKey={receipt.tracking_key} className="mt-6" />

        <section aria-labelledby="key-title" className="mt-8 rounded-lg bg-card p-5 shadow-soft">
          <h2 id="key-title" className="flex items-center gap-2 text-xl font-extrabold">
            <Icon name="key" className="size-6 text-blue" />
            {t("keyTitle")}
          </h2>
          <p className="mt-2 max-w-[38rem]">{t("keyBody")}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => copy(receipt.tracking_key, "key")} className={btn.primary}>
              <Icon name={copied === "key" ? "check" : "copy"} className="size-5" />
              {copied === "key" ? t("copied") : t("copyKey")}
            </button>
            <button type="button" onClick={saveFile} className={btn.soft}>
              <Icon name="download" className="size-5" />
              {t("saveKey")}
            </button>
            {canShare && (
              <button type="button" onClick={shareKey} className={`${btn.soft} sm:col-span-2`}>
                <Icon name="share" className="size-5" />
                {t("shareKey")}
              </button>
            )}
          </div>
          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-md bg-wash p-4 font-bold">
            <input
              id="saved-check"
              type="checkbox"
              checked={saved}
              onChange={(event) => {
                setSaved(event.target.checked);
                setWarn(false);
              }}
              className="size-6 shrink-0 accent-[var(--color-blue)]"
              aria-describedby={warn ? "saved-warn" : undefined}
            />
            {t("savedCheck")}
          </label>
          {warn && (
            <p id="saved-warn" role="alert" className="mt-2 text-sm font-semibold text-error">
              {t("saveFirst")}
            </p>
          )}
        </section>

        <button type="button" onClick={getPDF} disabled={pdf === "busy"} className={`${btn.soft} mt-5 w-full sm:w-auto`}>
          <Icon name="download" className="size-5" />
          {pdf === "busy" ? t("pdfLoading") : t("pdf")}
        </button>
        {pdf === "error" && (
          <p role="alert" className="mt-2 text-sm font-semibold text-error">
            {t("pdfError")}
          </p>
        )}

        <h2 className="mt-10 text-xl font-extrabold">{t("next")}</h2>
        <ul className="mt-3 grid gap-1">
          <li>
            <button type="button" onClick={() => leave({ pathname: "/track/[publicId]", params: { publicId: receipt.public_id } })} className={btn.link}>
              {t("track")}
            </button>
          </li>
          <li>
            <button type="button" onClick={() => leave("/report")} className={btn.link}>
              {t("another")}
            </button>
          </li>
          {canShare && (
            <li>
              <button type="button" onClick={sharePlatform} className={btn.link}>
                {t("share")}
              </button>
            </li>
          )}
          {!installed && (
            <li>
              <button type="button" onClick={openInstall} className={btn.link}>
                {ti("action")}
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
