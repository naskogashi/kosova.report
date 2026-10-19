"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Download, RefreshCw } from "lucide-react";
const copy = {
  sq: {
    title: "Ecuria e raportit",
    load: "Duke ngarkuar…",
    error:
      "Lidhja është e pavlefshme, ka skaduar ose raporti nuk është i disponueshëm.",
    refresh: "Rifresko",
    download: "Shkarko dëshminë PDF",
    pending: "Në pritje",
    progress: "Duke u trajtuar",
    resolved: "I zgjidhur",
    handling: "Po e trajtojmë këtë çështje",
    resolve: "Shëno si të zgjidhur",
    municipality: "Përditësimi i komunës",
    notice: "Kjo lidhje është private. Mos e ndani publikisht.",
    saved: "Përditësimi u ruajt.",
    saving: "Duke ruajtur…",
  },
  sr: {
    title: "Napredak prijave",
    load: "Učitavanje…",
    error: "Link je nevažeći, istekao je ili prijava nije dostupna.",
    refresh: "Osveži",
    download: "Preuzmi PDF potvrdu",
    pending: "Na čekanju",
    progress: "U obradi",
    resolved: "Rešeno",
    handling: "Radimo na ovom problemu",
    resolve: "Označi kao rešeno",
    municipality: "Ažuriranje opštine",
    notice: "Ovaj link je privatan. Nemojte ga javno deliti.",
    saved: "Ažuriranje je sačuvano.",
    saving: "Čuvanje…",
  },
  en: {
    title: "Report progress",
    load: "Loading…",
    error:
      "This private link is invalid, expired, or the report is unavailable.",
    refresh: "Refresh",
    download: "Download PDF receipt",
    pending: "Pending",
    progress: "Being handled",
    resolved: "Resolved",
    handling: "We are handling this issue",
    resolve: "Mark as resolved",
    municipality: "Municipality update",
    notice: "This link is private. Do not share it publicly.",
    saved: "Update saved.",
    saving: "Saving…",
  },
};
export default function ReportProgress({ publicId, municipality = false }) {
  const [language, setLanguage] = useState("sq"),
    [token, setToken] = useState(""),
    [report, setReport] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const t = copy[language],
    endpoint = `/api/${municipality ? "municipality" : "tracking"}/${encodeURIComponent(publicId)}`;
  useEffect(() => {
    const url = new URL(location.href),
      lang = url.searchParams.get("lang");
    if (Object.hasOwn(copy, lang)) setLanguage(lang);
    const key = new URLSearchParams(url.hash.slice(1)).get("key");
    if (key) {
      setToken(key);
      url.hash = "";
      history.replaceState({}, "", url);
    } else setError("link");
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw Error();
      setReport(await response.json());
    } catch {
      setError("link");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (token) load();
  }, [token]);
  async function update(status) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw Error();
      setReport((current) => ({ ...current, status }));
      setNotice(t.saved);
    } catch {
      setError("link");
    } finally {
      setBusy(false);
    }
  }
  async function pdf() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(publicId)}/pdf`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (!response.ok) throw Error();
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = `${publicId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setError("link");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <a href="/" className="text-xl font-bold text-blue-950">
          kosova.report
        </a>
        <nav aria-label="Language" className="flex gap-1">
          {["sq", "sr", "en"].map((value) => (
            <button
              key={value}
              onClick={() => setLanguage(value)}
              aria-pressed={language === value}
              className={`rounded-lg p-3 text-xs font-semibold ${language === value ? "bg-blue-700 text-white" : "bg-white"}`}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </nav>
      </header>
      <section className="space-y-5 rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-bold">
          {municipality ? t.municipality : t.title}
        </h1>
        <p className="text-sm text-slate-500">{t.notice}</p>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {t.error}
          </p>
        )}
        {!report && !error && <p role="status">{t.load}</p>}
        {report && (
          <>
            <h2 className="text-xl font-bold text-blue-900">
              {report.public_id}
            </h2>
            <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900">
              {report.status === "Resolved" ? (
                <CheckCircle2 size={18} />
              ) : (
                <Clock size={18} />
              )}
              {
                {
                  Pending: t.pending,
                  "In Progress": t.progress,
                  Resolved: t.resolved,
                }[report.status]
              }
            </p>
            <p className="text-sm text-slate-600">
              {report.city} · {report.category}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {report.description}
            </p>
            {notice && (
              <p role="status" className="text-sm text-emerald-800">
                {notice}
              </p>
            )}
            {municipality && report.status !== "Resolved" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  disabled={busy || report.status === "In Progress"}
                  onClick={() => update("In Progress")}
                  className="rounded-lg bg-blue-700 p-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? t.saving : t.handling}
                </button>
                <button
                  disabled={busy}
                  onClick={() => update("Resolved")}
                  className="rounded-lg bg-emerald-700 p-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {t.resolve}
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                disabled={busy}
                onClick={load}
                className="inline-flex items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <RefreshCw size={16} />
                {t.refresh}
              </button>
              {!municipality && (
                <button
                  disabled={busy}
                  onClick={pdf}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 p-3 text-sm text-white"
                >
                  <Download size={16} />
                  {t.download}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
