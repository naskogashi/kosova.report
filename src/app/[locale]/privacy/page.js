import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "../../../lib/seo";
import { wrap } from "../../../components/ui";
import { loadServerConfig } from "../../../lib/server-config";

loadServerConfig();

// Bump when the text changes in a way people should know about.
const UPDATED = "2026-10-20";
// Answers data questions and deletion requests. PRIVACY_CONTACT_EMAIL overrides it on a server.
const contact = process.env.PRIVACY_CONTACT_EMAIL || "privacy@kosova.report";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return pageMetadata({ locale, key: "privacy", internal: "/privacy" });
}

export default async function Privacy({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");
  const format = await getFormatter();
  // The contact section only appears once there is a real address to show.
  const sections = t.raw("sections").filter((section) => contact || !section.id.startsWith("kontakt"));
  const contents = (
    <ol className="grid gap-1">
      {sections.map((section) => (
        <li key={section.id}>
          <a href={`#${section.id}`} className="inline-flex min-h-10 items-center font-semibold text-blue hover:underline">
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <div className={`${wrap} py-10 lg:py-16`}>
      <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,42rem)] lg:gap-16">
        <aside className="lg:order-1">
          <details className="rounded-md bg-card p-4 shadow-[0_0_0_1px_var(--color-rule)] lg:hidden">
            <summary className="cursor-pointer font-extrabold">{t("contents")}</summary>
            <nav aria-label={t("contents")} className="mt-3">
              {contents}
            </nav>
          </details>
          <nav aria-label={t("contents")} className="sticky top-6 hidden lg:block">
            <p className="mb-2 text-sm font-bold text-pencil">{t("contents")}</p>
            {contents}
          </nav>
        </aside>
        <article className="lg:order-2">
          <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
          <p className="mt-2 text-sm text-pencil">
            <time dateTime={UPDATED}>
              {t("updated", { date: format.dateTime(new Date(UPDATED), { day: "numeric", month: "long", year: "numeric" }) })}
            </time>
          </p>
          <p className="mt-5 text-xl text-pencil">{t("intro")}</p>
          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="mt-10 scroll-mt-6">
              <h2 id={`${section.id}-title`} className="text-2xl font-extrabold tracking-[-0.02em]">
                <a href={`#${section.id}`} className="hover:underline">
                  {section.title}
                </a>
              </h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-lg leading-relaxed">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-3 grid list-disc gap-2 pl-6 text-lg leading-relaxed marker:text-blue">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.id.startsWith("kontakt") && contact && (
                <p className="mt-3 text-lg">
                  <a href={`mailto:${contact}`} className="font-bold text-blue underline underline-offset-4">
                    {contact}
                  </a>
                </p>
              )}
            </section>
          ))}
          <p className="mt-12 border-t border-rule pt-5 text-sm text-pencil">{t("note")}</p>
        </article>
      </div>
    </div>
  );
}
