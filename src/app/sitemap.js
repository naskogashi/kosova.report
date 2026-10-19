import { routing, hreflang } from "../i18n/routing";
import { localizedPath } from "../i18n/paths";
import { siteOrigin } from "../lib/seo";
import { publishedNews } from "../lib/news";

export const revalidate = 3600;

// Public, indexable pages only, each with its language alternates.
const pages = ["/", "/report", "/track", "/news", "/privacy"];

export default async function sitemap() {
  const origin = siteOrigin();
  const entry = (internal, locales, params, extra = {}) =>
    locales.map((locale) => ({
      url: `${origin}${localizedPath(internal, locale, params)}`,
      alternates: {
        languages: {
          ...Object.fromEntries(locales.map((l) => [hreflang[l], `${origin}${localizedPath(internal, l, params)}`])),
          "x-default": `${origin}${localizedPath(internal, "sq", params)}`,
        },
      },
      ...extra,
    }));
  const fixed = pages.flatMap((internal) =>
    entry(internal, routing.locales, undefined, {
      changeFrequency: internal === "/" || internal === "/news" ? "weekly" : "monthly",
      priority: internal === "/" ? 1 : 0.7,
    }),
  );
  // News posts, listed only in the languages they are written in.
  const posts = (await publishedNews({ limit: 500 })).flatMap((post) =>
    entry(
      "/news/[slug]",
      routing.locales.filter((l) => post[`title_${l}`]?.trim()),
      { slug: post.slug },
      { lastModified: post.updated_at ? new Date(post.updated_at) : undefined, priority: 0.6 },
    ),
  );
  return [...fixed, ...posts];
}
