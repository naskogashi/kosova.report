import { getTranslations, setRequestLocale } from "next-intl/server";
import NewsCard from "../../../components/NewsCard";
import { pageMetadata } from "../../../lib/seo";
import { localize, publishedNews } from "../../../lib/news";
import { wrap } from "../../../components/ui";

// Published from the staff panel; refreshed every two minutes.
export const revalidate = 120;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return pageMetadata({ locale, key: "news", internal: "/news" });
}

export default async function NewsIndex({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("news");
  const posts = (await publishedNews({ limit: 30 })).map((post) => localize(post, locale));
  const [first, ...rest] = posts;
  return (
    <div className={`${wrap} py-10 lg:py-16`}>
      <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      <p className="mt-3 max-w-[38rem] text-lg text-pencil">{t("sub")}</p>
      {!first ? (
        <p className="mt-10 max-w-[38rem] rounded-lg bg-wash p-6 text-lg">{t("empty")}</p>
      ) : (
        <>
          <div className="mt-10 max-w-[52rem]">
            <NewsCard post={first} locale={locale} large />
          </div>
          {rest.length > 0 && (
            <ul className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <li key={post.id}>
                  <NewsCard post={post} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
