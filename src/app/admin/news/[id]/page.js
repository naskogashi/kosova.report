import Link from "next/link";
import { notFound } from "next/navigation";
import { adminTranslator, adminLanguage } from "../../../../lib/admin-language";
import { requireOwner } from "../../../../lib/admin-session";
import { database } from "../../../../lib/db";
import { siteTitle } from "../../../../lib/site-branding";
import { newsKinds, newsLocales, toKosovoTime } from "../../../../lib/news";
import { localizedPath } from "../../../../i18n/paths";
import AdminNav from "../../AdminNav";
import AdminSubmit from "../../AdminSubmit";
import { saveNewsAction, deleteNewsAction } from "../actions";
import { btn, field } from "../../../../components/ui";
export const dynamic = "force-dynamic";

const languageNames = { sq: "Shqip", sr: "Srpski", en: "English" };
const errors = {
  title: "Write at least the Albanian title.",
  slug: "The web address may use only lowercase letters, digits and hyphens.",
  "slug-taken": "Another post already uses this web address. Change it.",
  date: "Check the publishing date and time.",
  cover: "The cover must be a JPEG, PNG or WebP image up to 5 MB.",
  confirm: "Tick the box to confirm deleting this post.",
  missing: "This post no longer exists.",
  setup: "Run the server setup command once to create the news table (migration 006).",
  save: "The post could not be saved. Check the connection to the database and storage, then try again.",
};

export async function generateMetadata() {
  const t = await adminTranslator();
  return {
    title: `${t("News")} | ${siteTitle(await adminLanguage())}`,
    robots: { index: false, follow: false },
  };
}

export default async function EditNews(props) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const t = await adminTranslator();
  await requireOwner();
  const creating = id === "new";
  if (!creating && !/^[1-9]\d{0,9}$/.test(id)) notFound();
  let post = { kind: "update", status: "draft" };
  if (!creating) {
    try {
      const [rows] = await database().execute("SELECT * FROM news_posts WHERE id=?", [id]);
      if (!rows.length) notFound();
      post = rows[0];
    } catch (error) {
      if (error?.digest) throw error;
      post = null;
    }
  }
  const publicPath = post?.slug ? localizedPath("/news/[slug]", "sq", { slug: post.slug }) : null;
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <AdminNav current="/admin/news" t={t} owner />
      <p className="mt-6">
        <Link href="/admin/news" className={btn.link}>
          {t("All posts")}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.025em]">
        {creating ? t("Write a post") : t("Edit post")}
      </h1>
      {searchParams.saved && (
        <p role="status" className="mt-5 flex flex-wrap items-center gap-3 rounded-md bg-ok-wash p-3 font-semibold text-ok">
          {t("Post saved.")}
          {post?.status === "published" && publicPath && (
            <a href={publicPath} className="underline underline-offset-4">
              {t("View on the site")}
            </a>
          )}
        </p>
      )}
      {searchParams.error && (
        <p role="alert" className="mt-5 rounded-md bg-error-wash p-3 font-semibold text-error">
          {t(errors[searchParams.error] || errors.save)}
        </p>
      )}
      {!post ? (
        <p role="alert" className="mt-6 rounded-md bg-error-wash p-5">{t(errors.setup)}</p>
      ) : (
        <form action={saveNewsAction} className="mt-8 grid gap-8">
          {!creating && <input type="hidden" name="id" value={post.id} />}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={field.label}>
              {t("Type")}
              <select name="kind" defaultValue={post.kind} className={field.input}>
                {newsKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(kind === "update" ? "Update" : kind === "article" ? "Article" : "Report")}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className={field.label}>{t("Status")}</legend>
              <div className="mt-2 flex gap-2">
                {["draft", "published"].map((status) => (
                  <label key={status} className="flex min-h-13 flex-1 cursor-pointer items-center gap-2 rounded-sm border-[1.5px] border-rule bg-card px-3 has-checked:border-blue has-checked:bg-wash">
                    <input type="radio" name="status" value={status} defaultChecked={post.status === status} className="size-5 accent-[var(--color-blue)]" />
                    <span className="font-bold">{status === "draft" ? t("Draft") : t("Published")}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={field.label}>
              {t("Web address")}
              <span className={field.hint}>{t("Leave empty to make one from the Albanian title.")}</span>
              <input name="slug" defaultValue={post.slug || ""} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} className={`${field.input} tabular`} autoComplete="off" spellCheck={false} />
            </label>
            <label className={field.label}>
              {t("Publish at (Kosovo time)")}
              <span className={field.hint}>{t("Leave empty to publish now. A future time schedules the post.")}</span>
              <input type="datetime-local" name="published_at" defaultValue={toKosovoTime(post.published_at)} className={field.input} />
            </label>
          </div>

          {newsLocales.map((l, index) => (
            <details key={l} open={index === 0 || Boolean(post[`title_${l}`])} className="rounded-lg bg-card p-5 shadow-[0_0_0_1px_var(--color-rule)]">
              <summary className="cursor-pointer text-xl font-extrabold">
                {languageNames[l]}
                {l === "sq" ? ` (${t("required")})` : ` (${t("optional, falls back to Albanian")})`}
              </summary>
              <div lang={l} className="mt-5 grid gap-5">
                <label className={field.label}>
                  {t("Title")}
                  <input name={`title_${l}`} defaultValue={post[`title_${l}`] || ""} maxLength={200} required={l === "sq"} className={field.input} />
                </label>
                <label className={field.label}>
                  {t("Summary")}
                  <span className={field.hint}>{t("One or two sentences. Shown in lists and in search results.")}</span>
                  <textarea name={`summary_${l}`} defaultValue={post[`summary_${l}`] || ""} maxLength={400} rows={2} className={field.input} />
                </label>
                <label className={field.label}>
                  {t("Text")}
                  <span className={field.hint}>
                    {t("Empty line for a new paragraph. ## for a heading, - for a list, **bold**, [text](https://link).")}
                  </span>
                  <textarea name={`body_${l}`} defaultValue={post[`body_${l}`] || ""} rows={14} className={`${field.input} leading-relaxed`} />
                </label>
                <label className={field.label}>
                  {t("Cover image description")}
                  <span className={field.hint}>{t("What the image shows, for people who can't see it.")}</span>
                  <input name={`cover_alt_${l}`} defaultValue={post[`cover_alt_${l}`] || ""} maxLength={200} className={field.input} />
                </label>
              </div>
            </details>
          ))}

          <fieldset className="rounded-lg bg-card p-5 shadow-[0_0_0_1px_var(--color-rule)]">
            <legend className="px-1 text-xl font-extrabold">{t("Cover image")}</legend>
            {post.cover_key && (
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <img src={`/api/news-images/${post.id}?v=${new Date(post.updated_at).getTime()}`} alt="" className="h-28 w-48 rounded-md object-cover" />
                <label className="flex items-center gap-2 font-bold">
                  <input type="checkbox" name="remove_cover" value="1" className="size-5 accent-[var(--color-blue)]" />
                  {t("Remove cover image")}
                </label>
              </div>
            )}
            <label className={`${field.label} mt-4`}>
              {post.cover_key ? t("Replace with") : t("Choose an image")}
              <span className={field.hint}>{t("JPEG, PNG or WebP, up to 5 MB. Stored in the image storage (R2).")}</span>
              <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-sm file:border-0 file:bg-wash file:px-4 file:font-bold file:text-blue" />
            </label>
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <AdminSubmit className="min-h-14 px-6 text-base">{t("Save post")}</AdminSubmit>
          </div>
        </form>
      )}

      {!creating && post && (
        <form action={deleteNewsAction} className="mt-12 rounded-lg border-[1.5px] border-error/40 p-5">
          <input type="hidden" name="id" value={post.id} />
          <h2 className="text-lg font-extrabold">{t("Delete this post")}</h2>
          <p className="mt-1 text-pencil">{t("The post and its cover image are removed for good.")}</p>
          <label className="mt-3 flex items-center gap-2 font-bold">
            <input type="checkbox" name="confirm" value="1" required className="size-5 accent-[var(--color-error)]" />
            {t("Yes, delete it")}
          </label>
          <button type="submit" className={`${btn.soft} mt-4 border-error text-error`}>
            {t("Delete post")}
          </button>
        </form>
      )}
    </div>
  );
}
