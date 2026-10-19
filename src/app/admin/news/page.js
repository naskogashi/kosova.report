import Link from "next/link";
import { adminTranslator, adminLanguage } from "../../../lib/admin-language";
import { requireOwner } from "../../../lib/admin-session";
import { database } from "../../../lib/db";
import { siteTitle } from "../../../lib/site-branding";
import AdminNav from "../AdminNav";
import { btn } from "../../../components/ui";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await adminTranslator();
  return {
    title: `${t("News")} | ${siteTitle(await adminLanguage())}`,
    robots: { index: false, follow: false },
  };
}

export default async function NewsList(props) {
  const searchParams = await props.searchParams;
  const t = await adminTranslator();
  const language = await adminLanguage();
  await requireOwner();
  let posts = [];
  let unavailable = false;
  try {
    [posts] = await database().query(
      "SELECT id,slug,kind,status,title_sq,title_sr,title_en,published_at,updated_at FROM news_posts ORDER BY COALESCE(published_at,updated_at) DESC LIMIT 200",
    );
  } catch {
    unavailable = true;
  }
  const format = (value) =>
    value
      ? new Intl.DateTimeFormat(language === "sq" ? "sq-AL" : "en-GB", {
          timeZone: "Europe/Belgrade",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "";
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <AdminNav current="/admin/news" t={t} owner />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-0.025em]">{t("News")}</h1>
          <p className="mt-1 text-pencil">{t("Updates, articles and reports for citizens.")}</p>
        </div>
        <Link href="/admin/news/new" className={btn.primary}>
          {t("Write a post")}
        </Link>
      </div>
      {searchParams.deleted && (
        <p role="status" className="mt-6 rounded-md bg-ok-wash p-3 font-semibold text-ok">
          {t("Post deleted.")}
        </p>
      )}
      {unavailable ? (
        <div role="alert" className="mt-8 rounded-md bg-error-wash p-5">
          <h2 className="font-extrabold">{t("News is not set up yet")}</h2>
          <p className="mt-1">{t("Run the server setup command once to create the news table (migration 006).")}</p>
        </div>
      ) : posts.length === 0 ? (
        <p className="mt-8 rounded-lg bg-wash p-6">{t("No posts yet. Write the first one.")}</p>
      ) : (
        <ul className="mt-8 grid gap-2">
          {posts.map((post) => {
            const languages = ["sq", "sr", "en"].filter((l) => post[`title_${l}`]);
            return (
              <li key={post.id}>
                <Link
                  href={`/admin/news/${post.id}`}
                  className="grid gap-1 rounded-md bg-card p-4 shadow-[0_0_0_1px_var(--color-rule)] hover:shadow-lift sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <span>
                    <span className="block font-extrabold">{post.title_sq || post.slug}</span>
                    <span className="mt-0.5 block text-sm text-pencil">
                      {t(post.kind === "update" ? "Update" : post.kind === "article" ? "Article" : "Report")}
                      {" · "}
                      {languages.map((l) => l.toUpperCase()).join(" ")}
                    </span>
                  </span>
                  <span className="text-sm sm:text-right">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 font-bold ${post.status === "published" ? "bg-ok-wash text-ok" : "bg-wash text-pencil"}`}>
                      {post.status === "published" ? t("Published") : t("Draft")}
                    </span>
                    <span className="tabular mt-1 block text-pencil">{format(post.published_at || post.updated_at)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
