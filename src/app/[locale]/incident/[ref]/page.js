import { cookies } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import IncidentView from "../../../../components/IncidentView";
import { wrap } from "../../../../components/ui";
import { localizedPath } from "../../../../i18n/paths";
import { database } from "../../../../lib/db";
import { VOTER_COOKIE, publicIncident, voterHash } from "../../../../lib/incidents";
import { validRef } from "../../../../lib/incident-matching";
import { localizedCityName } from "../../../../lib/municipality-names";
import { siteOrigin } from "../../../../lib/seo";

export const dynamic = "force-dynamic";

async function load(ref) {
  if (!validRef(ref)) return null;
  return publicIncident(database(), ref, voterHash((await cookies()).get(VOTER_COOKIE)?.value));
}

export async function generateMetadata({ params }) {
  const { locale, ref } = await params;
  const incident = await load(ref).catch(() => null);
  if (!incident || incident.redirect) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: "incident" });
  const tc = await getTranslations({ locale, namespace: "categories" });
  const title = `${tc(`${incident.category}.name`)} · ${t("heading", { city: localizedCityName(incident.city, locale) })}`;
  return {
    metadataBase: new URL(siteOrigin()),
    title: { absolute: `${title} | kosova.report`.slice(0, 70) },
    description: incident.summary || t("reported", { count: incident.report_count }),
    // Only issues staff have published are meant to be found by search engines.
    robots: incident.exact ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical: `${siteOrigin()}${localizedPath("/incident/[ref]", locale, { ref })}` },
  };
}

export default async function IncidentPage({ params }) {
  const { locale, ref } = await params;
  setRequestLocale(locale);
  const incident = await load(ref);
  if (!incident) notFound();
  // A merged issue sends people to the one it was merged into.
  if (incident.redirect) permanentRedirect(localizedPath("/incident/[ref]", locale, { ref: incident.redirect }));
  return (
    <div className={`${wrap} py-8 lg:py-14`}>
      <IncidentView incident={JSON.parse(JSON.stringify(incident))} />
    </div>
  );
}
