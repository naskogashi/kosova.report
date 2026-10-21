"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "../i18n/navigation";
import { Icon, categoryStyle } from "./icons";
import { btn, field } from "./ui";
import { categories } from "../lib/report-options";
import { localizedCityName } from "../lib/municipality-names";

const MapCanvas = dynamic(() => import("./TransparencyMapCanvas"), {
  ssr: false,
  loading: () => <div className="h-[min(70svh,36rem)] w-full animate-pulse rounded-lg bg-wash" />,
});

const DAY = 86400000;

// Filters, counts, the map and a plain list of the most recent issues (the same data without a map).
export default function TransparencyMap() {
  const t = useTranslations("map");
  const tc = useTranslations("categories");
  const ts = useTranslations("track");
  const locale = useLocale();
  const format = useFormatter();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");

  function load() {
    setFailed(false);
    fetch("/api/map")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((value) => {
        setData(value);
        setCity((current) => current || value.cities[0]?.code || "");
      })
      .catch(() => setFailed(true));
  }
  useEffect(load, []);

  const selected = data?.cities.find((item) => item.code === city);
  const shown = useMemo(() => {
    if (!data) return [];
    const since = period === "all" ? 0 : Date.now() - Number(period) * DAY;
    return data.incidents.filter(
      (issue) =>
        issue.city === city &&
        (!category || issue.category === category) &&
        (status === "all" || (status === "resolved") === (issue.status === "Resolved")) &&
        new Date(issue.last_reported_at).getTime() >= since,
    );
  }, [data, city, category, status, period]);
  const resolved = shown.filter((issue) => issue.status === "Resolved").length;
  const date = (value) => format.dateTime(new Date(value), { day: "numeric", month: "short", year: "numeric" });

  if (failed)
    return (
      <div role="alert" className="mt-8 flex flex-wrap items-center gap-3 rounded-md bg-wash p-4">
        <p className="flex-1 font-semibold">{t("error")}</p>
        <button type="button" onClick={load} className={btn.link}>
          <Icon name="refresh" className="size-5" />
          {t("retry")}
        </button>
      </div>
    );
  if (!data)
    return (
      <p role="status" className="mt-8 font-semibold text-pencil">
        {t("loading")}
      </p>
    );

  const select = `${field.input} mt-1 min-h-11 py-2`;
  return (
    <div className="mt-8 grid gap-5">
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => event.preventDefault()}>
        {data.cities.length > 1 && (
          <label className="text-sm font-bold">
            {t("municipality")}
            <select value={city} onChange={(event) => setCity(event.target.value)} className={select}>
              {data.cities.map((item) => (
                <option key={item.code} value={item.code}>
                  {localizedCityName(item.name, locale)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-bold">
          {t("category")}
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={select}>
            <option value="">{t("allCategories")}</option>
            {categories.map((key) => (
              <option key={key} value={key}>
                {tc(`${key}.name`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          {t("status")}
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={select}>
            <option value="all">{t("statusAll")}</option>
            <option value="open">{t("statusOpen")}</option>
            <option value="resolved">{t("statusResolved")}</option>
          </select>
        </label>
        <label className="text-sm font-bold">
          {t("period")}
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className={select}>
            <option value="all">{t("periodAll")}</option>
            <option value="90">{t("period90")}</option>
            <option value="30">{t("period30")}</option>
          </select>
        </label>
      </form>

      <p aria-live="polite" className="flex flex-wrap gap-x-4 gap-y-1 font-bold">
        <span>{t("shown", { count: shown.length })}</span>
        <span className="text-pencil">{t("open", { count: shown.length - resolved })}</span>
        <span className="text-pencil">{t("resolved", { count: resolved })}</span>
      </p>

      {selected && (
        <MapCanvas
          key={selected.code}
          city={selected}
          issues={shown}
          label={t("mapLabel")}
          text={{
            reported: (count) => t("reported", { count }),
            since: (value) => t("since", { date: date(value) }),
            open: t("openIssue"),
            category: (key) => tc(`${key}.name`),
            status: (key) => ts(`statuses.${key}`),
          }}
        />
      )}

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-pencil" aria-label={t("legend")}>
        {[
          ["pending", ts("statuses.Pending")],
          ["progress", ts("statuses.In Progress")],
          ["resolved", ts("statuses.Resolved")],
        ].map(([key, label]) => (
          <li key={key} className="flex items-center gap-2">
            <span aria-hidden="true" className={`map-swatch map-swatch-${key}`} />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="map-swatch map-swatch-area" />
          {t("legendApproximate")}
        </li>
      </ul>

      <p className="-mt-2 text-xs text-pencil">
        {t("delayNote", { hours: data.delayHours })}
        {data.waiting > 0 && <> {t("waiting", { count: data.waiting, hours: data.delayHours })}</>}
      </p>

      <section aria-labelledby="map-recent">
        <h2 id="map-recent" className="text-xl font-extrabold">
          {t("recent")}
        </h2>
        {shown.length === 0 ? (
          <p className="mt-3 text-pencil">{t("none")}</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {shown.slice(0, 12).map((issue) => (
              <li key={issue.ref} className="flex items-start gap-3 rounded-md bg-card p-3 shadow-[0_0_0_1px_var(--color-rule)]">
                <Icon name={issue.category} className={`mt-0.5 size-6 shrink-0 ${categoryStyle[issue.category]?.text || ""}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {tc(`${issue.category}.name`)} · <span className="text-pencil">{ts(`statuses.${issue.status}`)}</span>
                  </p>
                  <p className="text-sm text-pencil">
                    {t("reported", { count: issue.report_count })} · {date(issue.first_reported_at)}
                  </p>
                  <Link href={{ pathname: "/incident/[ref]", params: { ref: issue.ref } }} className={`${btn.link} text-sm`}>
                    {t("openIssue")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
