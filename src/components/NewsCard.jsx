import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "../i18n/navigation";

// One post in a list: type, date, title, summary. The whole card is the link.
export default async function NewsCard({ post, locale, large = false }) {
  const t = await getTranslations({ locale, namespace: "news" });
  const format = await getFormatter({ locale });
  const date = post.publishedAt
    ? format.dateTime(new Date(post.publishedAt), { day: "numeric", month: "long", year: "numeric" })
    : "";
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-card shadow-[0_0_0_1px_var(--color-rule)] transition-shadow duration-120 hover:shadow-lift">
      {post.hasCover && (
        <img
          src={`/api/news-images/${post.id}`}
          alt={post.coverAlt}
          loading="lazy"
          width="800"
          height="450"
          className={`w-full object-cover ${large ? "aspect-[16/8]" : "aspect-[16/9]"}`}
        />
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="rounded-full bg-wash px-2.5 py-0.5 font-bold text-blue">{t(`kinds.${post.kind}`)}</span>
          {date && (
            <time dateTime={post.publishedAt} className="tabular text-pencil">
              {date}
            </time>
          )}
        </p>
        <h3 lang={post.lang} className={`mt-3 font-extrabold tracking-[-0.02em] ${large ? "text-2xl" : "text-xl"}`}>
          <Link
            href={{ pathname: "/news/[slug]", params: { slug: post.slug } }}
            className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4"
          >
            {post.title}
          </Link>
        </h3>
        {post.summary && (
          <p lang={post.lang} className="mt-2 text-pencil">
            {post.summary}
          </p>
        )}
      </div>
    </article>
  );
}
