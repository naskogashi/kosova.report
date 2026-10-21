import { getTranslations } from "next-intl/server";
import PerformanceDashboard from "../../../../components/PerformanceDashboard";
import Wordmark from "../../../../components/Wordmark";
import { database } from "../../../../lib/db";
import { cachedPerformance } from "../../../../lib/performance";
import { localizedPath } from "../../../../i18n/paths";
import { siteOrigin } from "../../../../lib/seo";

export const dynamic = "force-dynamic";

// The embeddable widget: key numbers and the top of the agency scorecard.
export default async function PerformanceEmbed({ params, searchParams }) {
  const { locale } = await params;
  const { city } = await searchParams;
  const t = await getTranslations({ locale, namespace: "performance" });
  let data = null;
  try {
    data = await cachedPerformance(database(), typeof city === "string" ? city.toUpperCase() : "");
  } catch {
    data = null;
  }
  if (!data?.city) return <p className="p-4 text-sm">{t("unavailable")}</p>;
  const full = `${siteOrigin()}${localizedPath("/performance", locale)}?city=${data.city.code}`;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-extrabold">{t("title")}</h1>
        <a href={siteOrigin()} target="_blank" rel="noopener" aria-label="kosova.report">
          <Wordmark className="text-base" />
        </a>
      </div>
      <PerformanceDashboard data={data} locale={locale} compact fullURL={full} />
    </div>
  );
}
