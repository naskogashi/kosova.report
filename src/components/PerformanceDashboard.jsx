import { getTranslations } from "next-intl/server";
import { CategoryBars, MonthlyPairs, PlainBars, StatusSplit } from "./Charts";
import { localizedCityName } from "../lib/municipality-names";
import { MIN_REPORTS, RESPONSE_BUCKETS } from "../lib/performance";

const card = "rounded-lg bg-card p-5 shadow-[0_0_0_1px_var(--color-rule)]";
const dash = "–";

// The public institutional performance dashboard. `compact` is the embeddable widget: the key
// numbers and the top of the scorecard, with a link to the full page.
export default async function PerformanceDashboard({ data, locale, compact = false, fullURL }) {
  const t = await getTranslations({ locale, namespace: "performance" });
  const tc = await getTranslations({ locale, namespace: "categories" });
  const ts = await getTranslations({ locale, namespace: "track" });
  const { overall } = data;
  const value = (number, suffix = "") => (number === null || number === undefined ? dash : `${number}${suffix}`);
  const daysText = (number) => (number === null ? dash : t("days", { count: number }));
  const tiles = [
    [t("tileReports"), value(overall.total), t("tileReportsNote", { count: overall.last30 })],
    [t("tileResponse"), value(overall.responseRate, "%"), t("tileResponseNote")],
    [t("tileResolved"), value(overall.resolutionRate, "%"), t("tileResolvedNote", { count: overall.resolved })],
    [t("tileResponseTime"), daysText(overall.medianResponseDays), t("tileMedian")],
    [t("tileResolveTime"), daysText(overall.medianResolveDays), t("tileMedian")],
  ];
  const agencies = compact ? data.agencies.slice(0, 5) : data.agencies;

  return (
    <div className="grid gap-6">
      <ul className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-3 lg:grid-cols-5"}`}>
        {tiles.slice(0, compact ? 3 : 5).map(([label, number, note]) => (
          <li key={label} className={card}>
            <p className="text-sm font-bold text-pencil">{label}</p>
            <p className="tabular mt-1 text-3xl font-extrabold tracking-[-0.02em]">{number}</p>
            <p className="mt-1 text-xs text-pencil">{note}</p>
          </li>
        ))}
      </ul>

      {!compact && (
        <section className={card} aria-labelledby="perf-status">
          <h2 id="perf-status" className="text-xl font-extrabold">
            {t("statusTitle")}
          </h2>
          <div className="mt-4">
            <StatusSplit
              label={t("statusTitle")}
              total={t("tileReportsCount", { count: overall.total })}
              parts={[
                { key: "pending", label: ts("statuses.Pending"), value: overall.pending, color: "var(--color-chart-1)" },
                { key: "progress", label: ts("statuses.In Progress"), value: overall.inProgress, color: "var(--color-chart-2)" },
                { key: "resolved", label: ts("statuses.Resolved"), value: overall.resolved, color: "var(--color-chart-3)" },
              ]}
            />
          </div>
        </section>
      )}

      <section className={card} aria-labelledby="perf-agencies">
        <h2 id="perf-agencies" className="text-xl font-extrabold">
          {t("agenciesTitle")}
        </h2>
        <p className="mt-1 text-sm text-pencil">{t("agenciesSub", { min: MIN_REPORTS })}</p>
        {agencies.length === 0 ? (
          <p className="mt-4 rounded-sm bg-wash p-4 text-sm text-pencil">{t("empty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-[1.5px] border-ink">
                  <th scope="col" className="py-2 pr-3 font-bold">{t("colAgency")}</th>
                  <th scope="col" className="tabular px-2 py-2 text-right font-bold">{t("colReports")}</th>
                  <th scope="col" className="px-2 py-2 text-right font-bold">{t("colResponse")}</th>
                  {!compact && <th scope="col" className="px-2 py-2 text-right font-bold">{t("colResponseTime")}</th>}
                  <th scope="col" className="px-2 py-2 text-right font-bold">{t("colResolved")}</th>
                  {!compact && <th scope="col" className="px-2 py-2 text-right font-bold">{t("colResolveTime")}</th>}
                  <th scope="col" className="py-2 pl-2 font-bold">{t("colScore")}</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((agency) => (
                  <tr key={agency.id} className="border-b border-rule">
                    <th scope="row" className="py-2.5 pr-3 font-semibold">{agency.name}</th>
                    <td className="tabular px-2 py-2.5 text-right">{agency.total}</td>
                    <td className="tabular px-2 py-2.5 text-right">{value(agency.responseRate, "%")}</td>
                    {!compact && <td className="tabular px-2 py-2.5 text-right">{daysText(agency.medianResponseDays)}</td>}
                    <td className="tabular px-2 py-2.5 text-right">{value(agency.resolutionRate, "%")}</td>
                    {!compact && <td className="tabular px-2 py-2.5 text-right">{daysText(agency.medianResolveDays)}</td>}
                    <td className="py-2.5 pl-2">
                      {agency.score === null ? (
                        <span className="text-xs text-pencil">{t("tooFew")}</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-24 overflow-hidden rounded-full bg-wash" aria-hidden="true">
                            <span className="block h-full rounded-full bg-chart-3" style={{ width: `${agency.score}%` }} />
                          </span>
                          <b className="tabular">{agency.score}</b>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!compact && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={card} aria-labelledby="perf-months">
              <h2 id="perf-months" className="text-xl font-extrabold">
                {t("monthsTitle")}
              </h2>
              <div className="mt-4">
                <MonthlyPairs
                  months={data.months}
                  locale={locale}
                  label={t("monthsTitle")}
                  empty={t("empty")}
                  legend={[
                    { label: t("received"), color: "var(--color-chart-1)" },
                    { label: t("resolvedLegend"), color: "var(--color-chart-3)" },
                  ]}
                />
              </div>
            </section>
            <section className={card} aria-labelledby="perf-speed">
              <h2 id="perf-speed" className="text-xl font-extrabold">
                {t("speedTitle")}
              </h2>
              <p className="mt-1 text-sm text-pencil">{t("speedSub")}</p>
              <div className="mt-4">
                <PlainBars
                  label={t("speedTitle")}
                  rows={RESPONSE_BUCKETS.map((key) => ({ key, label: t(`bucket.${key}`), value: data.buckets[key] }))}
                />
              </div>
            </section>
          </div>

          <section className={card} aria-labelledby="perf-categories">
            <h2 id="perf-categories" className="text-xl font-extrabold">
              {t("categoriesTitle")}
            </h2>
            <div className="mt-4">
              <CategoryBars
                label={t("categoriesTitle")}
                rows={data.categories.map((row) => ({
                  key: row.category,
                  label: `${tc(`${row.category}.name`)} · ${t("resolvedShare", { percent: row.resolutionRate ?? 0 })}`,
                  value: row.total,
                }))}
              />
            </div>
          </section>

          <section className={card} aria-labelledby="perf-method">
            <h2 id="perf-method" className="text-xl font-extrabold">
              {t("methodTitle")}
            </h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {["Response", "Resolution", "Time", "Score", "Privacy", "Fresh"].map((key) => (
                <div key={key}>
                  <dt className="font-bold">{t(`method${key}Title`)}</dt>
                  <dd className="mt-0.5 text-pencil">{t(`method${key}`, { min: MIN_REPORTS })}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}

      {compact && fullURL && (
        <p className="text-sm">
          <a href={fullURL} target="_blank" rel="noopener" className="font-bold text-blue underline underline-offset-4">
            {t("embedMore", { city: localizedCityName(data.city.name, locale) })}
          </a>
        </p>
      )}
    </div>
  );
}
