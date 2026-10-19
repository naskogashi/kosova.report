import { getTranslations } from "next-intl/server";
import { routing, hreflang } from "../i18n/routing";
import { localizedPath } from "../i18n/paths";

export const siteOrigin = () =>
  new URL(process.env.APP_URL || "https://kosova.report").origin;

// Title, description, canonical, hreflang alternates and social cards for one page in one locale.
export async function pageMetadata({
  locale,
  key,
  internal = "/",
  params,
  noindex = false,
}) {
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t(`${key}.title`);
  const description = t.has(`${key}.description`)
    ? t(`${key}.description`)
    : undefined;
  const origin = siteOrigin();
  const url = (l) => `${origin}${localizedPath(internal, l, params)}`;
  const languages = Object.fromEntries(
    routing.locales.map((l) => [hreflang[l], url(l)]),
  );
  languages["x-default"] = url(routing.defaultLocale);
  return {
    metadataBase: new URL(origin),
    title: { absolute: title },
    description,
    alternates: noindex
      ? undefined
      : { canonical: url(locale), languages },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: noindex
      ? undefined
      : {
          type: "website",
          siteName: "kosova.report",
          title,
          description,
          url: url(locale),
          locale: { sq: "sq_AL", sr: "sr_RS", en: "en_GB" }[locale],
        },
    twitter: noindex
      ? undefined
      : { card: "summary_large_image", title, description },
  };
}
