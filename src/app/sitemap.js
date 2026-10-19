import { routing, hreflang } from "../i18n/routing";
import { localizedPath } from "../i18n/paths";
import { siteOrigin } from "../lib/seo";

// Public, indexable pages only, each with its language alternates.
const pages = ["/", "/report", "/track"];

export default function sitemap() {
  const origin = siteOrigin();
  return pages.flatMap((internal) =>
    routing.locales.map((locale) => ({
      url: `${origin}${localizedPath(internal, locale)}`,
      changeFrequency: internal === "/" ? "weekly" : "monthly",
      priority: internal === "/" ? 1 : 0.7,
      alternates: {
        languages: {
          ...Object.fromEntries(
            routing.locales.map((l) => [hreflang[l], `${origin}${localizedPath(internal, l)}`]),
          ),
          "x-default": `${origin}${localizedPath(internal, routing.defaultLocale)}`,
        },
      },
    })),
  );
}
