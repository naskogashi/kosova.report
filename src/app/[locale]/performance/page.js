import { getTranslations, setRequestLocale } from "next-intl/server";
import PerformanceDashboard from "../../../components/PerformanceDashboard";
import { Link } from "../../../i18n/navigation";
import { btn, wrap } from "../../../components/ui";
import { Icon } from "../../../components/icons";
import { database } from "../../../lib/db";
import { cachedPerformance } from "../../../lib/performance";
import { localizedCityName } from "../../../lib/municipality-names";
import { pageMetadata, siteOrigin } from "../../../lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return pageMetadata({ locale, key: "performance", internal: "/performance" });
}

// Public institutional performance dashboard: how each connected agency responds.
export default async function PerformancePage({ params, searchParams }) {
  const { locale } = await params;
  const { city } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("performance");
  let data = null;
  try {
    data = await cachedPerformance(database(), typeof city === "string" ? city.toUpperCase() : "");
  } catch {
    data = null;
  }
  const code = data?.city?.code;
  const embed = code ? `<iframe src="${siteOrigin()}/embed/${locale}/performance?city=${code}" title="kosova.report" width="100%" height="560" style="border:0" loading="lazy"></iframe>` : "";
  return (
    <div className={`${wrap} py-10 lg:py-14`}>
      <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      <p className="mt-3 max-w-[44rem] text-lg text-pencil">{t("intro")}</p>
      {data?.cities.length > 1 && (
        <nav aria-label={t("municipality")} className="mt-4 flex flex-wrap gap-2">
          {data.cities.map((item) => (
            <Link
              key={item.code}
              href={{ pathname: "/performance", query: { city: item.code } }}
              aria-current={item.code === code ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold shadow-[0_0_0_1px_var(--color-rule)] aria-[current=page]:bg-ink aria-[current=page]:text-paper"
            >
              {localizedCityName(item.name, locale)}
            </Link>
          ))}
        </nav>
      )}
      {!data?.city ? (
        <p role="alert" className="mt-8 rounded-md bg-wash p-4 font-semibold">
          {t("unavailable")}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-pencil">
            {t("scope", { city: localizedCityName(data.city.name, locale) })}
          </p>
          <div className="mt-8">
            <PerformanceDashboard data={data} locale={locale} />
          </div>
          <section aria-labelledby="perf-use" className="mt-6 rounded-lg bg-wash p-5">
            <h2 id="perf-use" className="text-xl font-extrabold">
              {t("useTitle")}
            </h2>
            <p className="mt-1 max-w-[44rem] text-sm">{t("useSub")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/api/performance/csv?city=${code}`} className={btn.soft} download>
                <Icon name="download" className="size-5" />
                {t("csv")}
              </a>
              <Link href="/map" className={btn.soft}>
                <Icon name="pin" className="size-5" />
                {t("mapLink")}
              </Link>
            </div>
            <label className="mt-5 block text-sm font-bold">
              {t("embedLabel")}
              <textarea readOnly rows={3} value={embed} className="mt-1 block w-full rounded-sm border-[1.5px] border-rule bg-card p-3 font-mono text-xs" />
            </label>
            <p className="mt-1 text-xs text-pencil">{t("embedHint")}</p>
          </section>
        </>
      )}
    </div>
  );
}
