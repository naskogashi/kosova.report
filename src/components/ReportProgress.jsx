"use client";
import { useCallback, useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import Receipt from "./Receipt";
import TrackForm from "./TrackForm";
import { Icon } from "./icons";
import { Link } from "../i18n/navigation";
import { btn, wrap } from "./ui";
import { localizedCityName } from "../lib/municipality-names";
import { downloadReportPDF } from "../lib/report-pdf-client";
import { forgetKey } from "../lib/push-client";
import FollowReport from "./FollowReport";

const order = ["Pending", "In Progress", "Resolved"];

// Citizen progress (/track) and the department's update page (/municipality).
// The key arrives in the #fragment, is kept for this tab only, and is removed from the address bar.
export default function ReportProgress({ publicId, municipality = false }) {
  const t = useTranslations("track");
  const tm = useTranslations("municipality");
  const ts = useTranslations("sent");
  const locale = useLocale();
  const format = useFormatter();
  const [token, setToken] = useState(null);
  const [report, setReport] = useState(null);
  const [state, setState] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pdfError, setPdfError] = useState(false);
  const [closed, setClosed] = useState(null);
  const storeKey = `kr-${municipality ? "dept" : "key"}:${publicId}`;
  const endpoint = `/api/${municipality ? "municipality" : "tracking"}/${encodeURIComponent(publicId)}`;

  useEffect(() => {
    const fromHash = new URLSearchParams(location.hash.slice(1)).get("key");
    if (fromHash) {
      try {
        sessionStorage.setItem(storeKey, fromHash);
      } catch {}
      history.replaceState(history.state, "", location.pathname + location.search);
    }
    let stored = null;
    try {
      stored = sessionStorage.getItem(storeKey);
    } catch {}
    setToken(fromHash || stored || "");
  }, [storeKey]);

  const load = useCallback(async () => {
    if (!token) return;
    setState("loading");
    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (response.status === 404) return setState("notFound");
      // Resolved more than 30 days ago: files and contact details are gone, and so is the key.
      if (response.status === 410 && !municipality) {
        setClosed(await response.json());
        try {
          sessionStorage.removeItem(storeKey);
        } catch {}
        forgetKey(publicId);
        return setState("anonymized");
      }
      if (!response.ok) return setState("unavailable");
      setReport(await response.json());
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, [endpoint, token, municipality, storeKey, publicId]);
  useEffect(() => {
    load();
  }, [load]);

  async function update(status) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error();
      setReport((current) => ({ ...current, status }));
      setNotice(tm("saved"));
    } catch {
      setNotice(tm("error"));
    } finally {
      setBusy(false);
    }
  }

  const heading = municipality ? tm("heading") : t("heading");
  if (token === null) return <div className="min-h-[60svh]" />;
  if (!token && !municipality)
    return (
      <div className={`${wrap} py-10 lg:py-16`}>
        <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{t("heading")}</h1>
        <TrackForm initialNumber={publicId} notice={t("noKey")} />
      </div>
    );

  const date = (value) =>
    value
      ? format.dateTime(new Date(value), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : null;
  const reached = report ? order.indexOf(report.status) : -1;
  const timeline = report
    ? [
        { label: t("timeline.submitted"), date: date(report.created_at), done: true },
        { label: t("timeline.routed"), done: true },
        { label: t("timeline.handling"), done: reached >= 1 },
        { label: t("timeline.resolved"), date: date(report.resolved_at), done: reached >= 2 },
      ]
    : [];

  return (
    <div className={`${wrap} grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_27.5rem] lg:gap-16 lg:py-14`}>
      <div className="min-w-0">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{heading}</h1>
        <p className="mt-3 flex items-start gap-2 text-sm text-pencil">
          <Icon name="key" className="mt-0.5 size-4 shrink-0" />
          {t("private")}
        </p>

        {state === "loading" && !report && (
          <p role="status" className="mt-8 text-lg font-semibold text-pencil">
            {t("loading")}
          </p>
        )}
        {(state === "notFound" || (municipality && !token)) && (
          <div role="alert" className="mt-8 max-w-[34rem]">
            <p className="text-lg font-semibold">{municipality ? tm("error") : t("notFound")}</p>
            {!municipality && <TrackForm initialNumber={publicId} />}
          </div>
        )}
        {state === "anonymized" && closed && (
          <div role="status" className="mt-8 max-w-[34rem]">
            <p className="text-sm font-bold text-pencil">{t("status")}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-[-0.02em] text-blue">{t("statuses.Resolved")}</p>
            <p className="mt-4 text-lg">
              {t("anonymized", { resolved: date(closed.resolved_at), anonymized: date(closed.anonymized_at) })}
            </p>
          </div>
        )}
        {state === "unavailable" && (
          <div role="alert" className="mt-8 flex flex-wrap items-center gap-3 rounded-md bg-wash p-4">
            <p className="flex-1 font-semibold">{t("unavailable")}</p>
            <button type="button" onClick={load} className={btn.link}>
              <Icon name="refresh" className="size-5" />
              {t("refresh")}
            </button>
          </div>
        )}

        {report && (
          <>
            <p className="mt-8 text-sm font-bold text-pencil">{t("status")}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-[-0.02em] text-blue">{t(`statuses.${report.status}`)}</p>
            <ol className="mt-6 grid max-w-[34rem]">
              {timeline.map((item, index) => (
                <li key={item.label} className="relative grid grid-cols-[2rem_1fr] gap-3 pb-6 last:pb-0">
                  {index < timeline.length - 1 && (
                    <span aria-hidden="true" className={`absolute top-8 bottom-0 left-[0.9375rem] w-0.5 ${timeline[index + 1].done ? "bg-blue" : "bg-rule"}`} />
                  )}
                  <span className={`relative flex size-8 items-center justify-center rounded-full ${item.done ? "bg-blue text-on-blue" : "border-2 border-rule bg-card"}`}>
                    {item.done && <Icon name="check" className="size-5" />}
                  </span>
                  <span className="pt-1">
                    <span className={`block font-bold ${item.done ? "" : "text-pencil"}`}>{item.label}</span>
                    {item.date && <span className="tabular block text-sm text-pencil">{item.date}</span>}
                  </span>
                </li>
              ))}
            </ol>

            {!municipality && report.status !== "Resolved" && (
              <FollowReport publicId={publicId} trackingKey={token} className="mt-6 max-w-[34rem]" />
            )}

            {!municipality && report.incident && (
              <div className="mt-6 flex max-w-[34rem] items-start gap-3 rounded-md bg-wash p-4">
                <Icon name="group" className="mt-0.5 size-6 shrink-0 text-blue" />
                <div>
                  <p className="font-bold">
                    {t("incident", { count: report.incident.report_count })}
                    {report.incident.upvote_count > 0 && <> · {t("incidentConfirms", { count: report.incident.upvote_count })}</>}
                  </p>
                  <Link href={{ pathname: "/incident/[ref]", params: { ref: report.incident.ref } }} className={`${btn.link} text-sm`}>
                    {t("incidentOpen")}
                  </Link>
                </div>
              </div>
            )}

            <div aria-live="polite" className="mt-6">
              {notice && <p className="rounded-md bg-wash p-3 text-sm font-semibold">{notice}</p>}
            </div>

            {municipality && report.status !== "Resolved" && (
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={busy || report.status === "In Progress"} onClick={() => update("In Progress")} className={btn.soft}>
                  {busy ? tm("saving") : tm("handling")}
                </button>
                <button type="button" disabled={busy} onClick={() => update("Resolved")} className={btn.primary}>
                  <Icon name="check" className="size-5" />
                  {tm("resolve")}
                </button>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-2">
              <button type="button" onClick={load} disabled={state === "loading"} className={btn.soft}>
                <Icon name="refresh" className="size-5" />
                {t("refresh")}
              </button>
              {!municipality && (
                <button
                  type="button"
                  onClick={async () => {
                    setPdfError(false);
                    try {
                      await downloadReportPDF(publicId, token);
                    } catch {
                      setPdfError(true);
                    }
                  }}
                  className={btn.primary}
                >
                  <Icon name="download" className="size-5" />
                  {t("pdf")}
                </button>
              )}
            </div>
            {pdfError && <p role="alert" className="mt-2 text-sm font-semibold text-error">{ts("pdfError")}</p>}
          </>
        )}
      </div>
      {report && (
        <aside className="flex justify-center lg:block">
          <div className="lg:sticky lg:top-6 lg:rotate-[-1.5deg]">
            <Receipt
              publicId={report.public_id}
              category={report.category}
              cityName={localizedCityName(report.city, locale)}
              position={report.lat != null && report.lng != null ? [Number(report.lat), Number(report.lng)] : null}
              description={report.description}
              submittedAt={report.created_at}
              stamped
            />
          </div>
        </aside>
      )}
    </div>
  );
}
