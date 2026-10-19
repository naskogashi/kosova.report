import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "../../../../i18n/navigation";
import { localizedPath } from "../../../../i18n/paths";
import { routing, hreflang } from "../../../../i18n/routing";
import NewsBody from "../../../../components/NewsBody";
import { Icon } from "../../../../components/icons";
import { btn, wrap } from "../../../../components/ui";
import { localize, publishedPost } from "../../../../lib/news";
import { siteOrigin } from "../../../../lib/seo";

export const revalidate = 120;

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  const post = await publishedPost(slug);
  if (!post) return { robots: { index: false } };
  const local = localize(post, locale);
  const origin = siteOrigin();
  const url = (l) => `${origin}${localizedPath("/news/[slug]", l, { slug })}`;
  // Only languages the post is actually written in get an hreflang alternate.
  const written = routing.locales.filter((l) => post[`title_${l}`]?.trim());
  const languages = Object.fromEntries(written.map((l) => [hreflang[l], url(l)]));
  languages["x-default"] = url("sq");
  return {
    metadataBase: new URL(origin),
    title: { absolute: `${local.title} | kosova.report`.slice(0, 70) },
    description: local.summary || undefined,
    alternates: { canonical: url(local.lang), languages },
    openGraph: {
      type: "article",
      siteName: "kosova.report",
      title: local.title,
      description: local.summary || undefined,
      url: url(locale),
      publishedTime: local.publishedAt,
      modifiedTime: local.updatedAt,
      images: local.hasCover ? [`${origin}/api/news-images/${post.id}`] : undefined,
    },
    twitter: { card: "summary_large_image", title: local.title, description: local.summary || undefined },
  };
}

export default async function NewsArticle({ params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await publishedPost(slug);
  if (!post) notFound();
  const local = localize(post, locale);
  const t = await getTranslations("news");
  const format = await getFormatter();
  const origin = siteOrigin();
  const date = local.publishedAt
    ? format.dateTime(new Date(local.publishedAt), { day: "numeric", month: "long", year: "numeric" })
    : "";
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": local.kind === "report" ? "Report" : "Article",
      headline: local.title,
      description: local.summary || undefined,
      datePublished: local.publishedAt,
      dateModified: local.updatedAt,
      inLanguage: local.lang,
      image: local.hasCover ? `${origin}/api/news-images/${post.id}` : undefined,
      publisher: { "@type": "Organization", name: "kosova.report", url: origin },
      mainEntityOfPage: `${origin}${localizedPath("/news/[slug]", locale, { slug })}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "kosova.report", item: `${origin}${localizedPath("/", locale)}` },
        { "@type": "ListItem", position: 2, name: t("title"), item: `${origin}${localizedPath("/news", locale)}` },
        { "@type": "ListItem", position: 3, name: local.title },
      ],
    },
  ];
  return (
    <article className={`${wrap} py-8 lg:py-14`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label={t("title")}>
        <Link href="/news" className={btn.link}>
          <Icon name="back" className="size-5" />
          {t("back")}
        </Link>
      </nav>
      <div className="mx-auto mt-6 max-w-[42rem]">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="rounded-full bg-wash px-2.5 py-0.5 font-bold text-blue">{t(`kinds.${local.kind}`)}</span>
          {date && (
            <time dateTime={local.publishedAt} className="tabular text-pencil">
              {t("published", { date })}
            </time>
          )}
        </p>
        <h1 lang={local.lang} className="mt-4 text-4xl font-extrabold tracking-[-0.03em]">
          {local.title}
        </h1>
        {local.summary && (
          <p lang={local.lang} className="mt-4 text-xl text-pencil">
            {local.summary}
          </p>
        )}
        {local.lang !== locale && (
          <p className="mt-5 rounded-md bg-wash p-3 text-sm font-semibold">{t("onlyIn")}</p>
        )}
      </div>
      {local.hasCover && (
        <img
          src={`/api/news-images/${post.id}`}
          alt={local.coverAlt}
          width="1200"
          height="600"
          className="mx-auto mt-8 aspect-[2/1] w-full max-w-[56rem] rounded-lg object-cover"
        />
      )}
      <div lang={local.lang} className="mx-auto mt-8 max-w-[42rem]">
        <NewsBody body={local.body} />
      </div>
    </article>
  );
}
