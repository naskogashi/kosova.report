"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "../i18n/navigation";
import { Icon, categoryStyle } from "./icons";
import { btn } from "./ui";

const IncidentMap = dynamic(() => import("./IncidentMap"), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse bg-wash" />,
});

// "Has someone already reported this?" Shown under the map once the place and category are known.
// Being close isn't proof: two potholes 20 m apart are two problems. So the reporter decides:
//   - "Yes, this is it": their report is added to that issue (they keep their own number and key),
//     or they only give it a thumbs-up and send nothing new;
//   - "No, mine is different": a new issue, and staff are told which nearby ones the reporter ruled out.
// Ignoring the panel is fine too; staff still see possible duplicates.
export default function NearbyIncidents({ city, category, position, accuracy, choice, onChoice, onConfirmed }) {
  const t = useTranslations("report.nearby");
  const tc = useTranslations("categories");
  const ti = useTranslations("incident");
  const format = useFormatter();
  const [state, setState] = useState({ status: "idle", incidents: [] });
  const [voting, setVoting] = useState("");
  const [voteError, setVoteError] = useState(false);

  const lat = position?.[0],
    lng = position?.[1];
  useEffect(() => {
    if (!city || !category || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setState({ status: "idle", incidents: [] });
      return;
    }
    const controller = new AbortController();
    // Wait until the pin stops moving.
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, status: "loading" }));
      const query = new URLSearchParams({ city, category, lat: lat.toFixed(6), lng: lng.toFixed(6) });
      if (accuracy) query.set("accuracy", String(Math.round(accuracy)));
      fetch(`/api/incidents/nearby?${query}`, { cache: "no-store", signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((data) => setState({ status: "ready", incidents: data.incidents || [] }))
        .catch((error) => error?.name !== "AbortError" && setState({ status: "error", incidents: [] }));
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [city, category, lat, lng, accuracy]);

  const incidents = state.incidents;
  // A chosen issue that is no longer near the pin (it was moved) is forgotten.
  useEffect(() => {
    if (state.status !== "ready" || !choice.incident) return;
    if (!incidents.some((item) => item.ref === choice.incident && item.joinable)) onChoice({ incident: "", declined: [] });
  }, [state.status, incidents, choice.incident]);

  if (state.status === "idle" || (state.status === "ready" && !incidents.length) || state.status === "error") return null;
  if (state.status === "loading" && !incidents.length)
    return (
      <p role="status" className="rounded-md bg-wash p-3 text-sm font-semibold text-pencil">
        {t("checking")}
      </p>
    );

  const date = (value) => format.dateTime(new Date(value), { day: "numeric", month: "short", year: "numeric" });
  const chosen = incidents.find((item) => item.ref === choice.incident);
  // Ruled out everything shown. A new issue appearing (the pin moved) asks again.
  const declinedAll =
    !choice.incident && choice.declined.length > 0 && incidents.every((item) => choice.declined.includes(item.ref));

  async function confirmOnly(ref) {
    setVoting(ref);
    setVoteError(false);
    try {
      const response = await fetch(`/api/incidents/${ref}/vote`, { method: "POST" });
      if (!response.ok) throw new Error();
      onConfirmed?.(ref);
    } catch {
      setVoteError(true);
    } finally {
      setVoting("");
    }
  }

  if (declinedAll)
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-wash p-3 text-sm font-semibold">
        <span className="flex-1">{t("declinedNote", { count: choice.declined.length })}</span>
        <button type="button" onClick={() => onChoice({ incident: "", declined: [] })} className={btn.link}>
          {t("change")}
        </button>
      </p>
    );

  return (
    <section aria-labelledby="nearby-title" className="rounded-lg bg-card p-4 shadow-[0_0_0_1.5px_var(--color-gold)] sm:p-5">
      <h2 id="nearby-title" className="flex items-start gap-2 text-xl font-extrabold">
        <Icon name="info" className="mt-1 size-5 shrink-0 text-blue" />
        {t("heading", { count: incidents.length })}
      </h2>
      <p className="mt-1 text-sm text-pencil">{t("sub")}</p>

      <div className="mt-4 overflow-hidden rounded-md shadow-[0_0_0_1px_var(--color-rule)]">
        <IncidentMap
          you={position}
          label={t("mapLabel")}
          className="h-56"
          places={incidents.map((item, index) => ({
            key: item.ref,
            point: item.point,
            exact: item.exact,
            number: index + 1,
            selected: item.ref === choice.incident,
          }))}
        />
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs text-pencil">
        <span aria-hidden="true" className="inline-block size-3 rounded-full bg-gold ring-1 ring-ink" />
        {t("yourPin")}
      </p>

      <ol className="mt-4 grid gap-3">
        {incidents.map((item, index) => {
          const style = categoryStyle[item.category];
          const selected = item.ref === choice.incident;
          return (
            <li
              key={item.ref}
              className={`rounded-md border-[1.5px] p-3 ${selected ? "border-blue bg-wash" : "border-rule"}`}
            >
              <div className="flex items-start gap-3">
                <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full font-extrabold text-blue shadow-[0_0_0_2px_var(--color-blue)]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`inline-flex items-center gap-1.5 font-extrabold ${style?.text || ""}`}>
                      {style && <Icon name={item.category} className="size-5" />}
                      {tc(`${item.category}.name`)}
                    </span>
                    {!item.same_category && (
                      <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-pencil">{t("otherCategory")}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.status === "Resolved" ? "bg-ok-wash text-ok" : "bg-wash text-blue"}`}>
                      {ti(`statuses.${item.status}`)}
                    </span>
                  </p>
                  <p className="tabular mt-1 text-sm text-pencil">
                    {t("distance", { meters: item.distance_m })} · {t("since", { date: date(item.first_reported_at) })}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {ti("reported", { count: item.report_count })}
                    {item.upvote_count > 0 && <> · {ti("confirms", { count: item.upvote_count })}</>}
                  </p>
                  {item.summary && <p className="mt-2 text-sm break-words">{item.summary}</p>}
                  <Link
                    href={{ pathname: "/incident/[ref]", params: { ref: item.ref } }}
                    target="_blank"
                    className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-blue underline underline-offset-4"
                  >
                    {t("open")}
                  </Link>
                </div>
              </div>

              {item.joinable ? (
                selected ? (
                  <div className="mt-3 grid gap-2">
                    <p className="text-sm font-semibold">{t("chosen")}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p className="flex items-start gap-2 rounded-md bg-card p-3 text-sm">
                        <Icon name="check" className="mt-0.5 size-5 shrink-0 text-blue" />
                        {t("addMine")}
                      </p>
                      <button
                        type="button"
                        onClick={() => confirmOnly(item.ref)}
                        disabled={voting === item.ref}
                        className={`${btn.soft} min-h-12 text-sm`}
                      >
                        <Icon name="thumb" className="size-5" />
                        {voting === item.ref ? t("confirming") : t("confirmOnly")}
                      </button>
                    </div>
                    {voteError && (
                      <p role="alert" className="text-sm font-semibold text-error">
                        {t("confirmError")}
                      </p>
                    )}
                    <button type="button" onClick={() => onChoice({ incident: "", declined: [] })} className={`${btn.link} text-sm`}>
                      {t("notThis")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChoice({ incident: item.ref, declined: [], count: item.report_count + 1 })}
                    className={`${btn.soft} mt-3 min-h-12 w-full text-sm sm:w-auto`}
                    aria-describedby="nearby-title"
                  >
                    {t("same")}
                  </button>
                )
              ) : (
                <p className="mt-3 rounded-md bg-ok-wash p-3 text-sm">
                  {t("resolvedNote", { date: date(item.resolved_at) })}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!chosen && (
        <button
          type="button"
          onClick={() => onChoice({ incident: "", declined: incidents.map((item) => item.ref) })}
          className={`${btn.primary} mt-4 w-full`}
        >
          {t("different")}
        </button>
      )}
    </section>
  );
}
