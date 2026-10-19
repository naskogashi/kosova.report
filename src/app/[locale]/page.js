import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "../../i18n/navigation";
import Receipt from "../../components/Receipt";
import InstallBand from "../../components/InstallBand";
import NewsCard from "../../components/NewsCard";
import { localize, publishedNews } from "../../lib/news";
import { Icon, categoryStyle } from "../../components/icons";
import { btn, wrap } from "../../components/ui";
import { categories } from "../../lib/report-options";
import { pageMetadata, siteOrigin } from "../../lib/seo";
import { localizedPath } from "../../i18n/paths";

// Static, refreshed every two minutes so new news posts appear without a rebuild.
export const revalidate = 120;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return pageMetadata({ locale, key: "home", internal: "/" });
}

// Sample pins on real central Prishtina streets (map units from public/maps/prishtina.svg).
const pins = [
  ["education", 468, 261],
  ["environment", 418, 381],
  ["administration", 431, 416],
  ["public_services", 361, 498],
  ["safety", 382, 557],
  ["health", 603, 594],
];
const pinPath = "M0 0C0 0-11-12.5-11-20a11 11 0 0 1 22 0C11-12.5 0 0 0 0Z";

export default async function Home({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("categories");
  const tm = await getTranslations("meta");
  const ts = await getTranslations("sent");
  const tn = await getTranslations("news");
  const latest = (await publishedNews({ limit: 3 })).map((post) => localize(post, locale));
  const origin = siteOrigin();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "kosova.report",
      url: origin,
      logo: `${origin}/icons/icon-512.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "kosova.report",
      url: `${origin}${localizedPath("/", locale)}`,
      inLanguage: locale,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "kosova.report",
      url: `${origin}${localizedPath("/report", locale)}`,
      applicationCategory: "GovernmentApplication",
      operatingSystem: "Any",
      inLanguage: locale,
      description: tm("home.description"),
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
  ];
  const sample = {
    publicId: "PR-2026-000418",
    category: "infrastructure",
    cityName: locale === "sq" ? "Prishtinë" : locale === "sr" ? "Priština" : "Prishtina",
    position: [42.66433, 21.165],
    description: t("sampleText"),
    anonymous: true,
    submittedAt: "2026-10-19T12:32:00Z",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Opening: the city itself, drawn from its real streets. */}
      <section aria-labelledby="hero-title" className="bg-wash">
        <div className={`${wrap} grid gap-10 pt-8 pb-12 lg:grid-cols-[7fr_6fr] lg:items-center lg:gap-14 lg:py-16`}>
          <div>
            <h1 id="hero-title" className="text-4xl font-extrabold tracking-[-0.03em]">
              {tm("slogan")}
            </h1>
            <p className="mt-5 max-w-[33em] text-lg text-pencil">{t("lede")}</p>
            <p className="mt-4 inline-flex items-start gap-2 rounded-full bg-card px-4 py-2 text-sm font-bold">
              <Icon name="pin" className="mt-px size-[1.125rem] shrink-0 text-blue" />
              {t("citiesSoon")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/report" className={btn.primary}>
                {t("cta")}
              </Link>
              <a href="#how" className={btn.soft}>
                {t("see")}
              </a>
            </div>
            <p className="mt-6 flex max-w-[33em] items-start gap-2.5 text-sm">
              <Icon name="info" className="mt-0.5 size-5 shrink-0 text-blue" />
              <span>
                {t("disclaimerShort")}{" "}
                <a href="tel:112" className="tabular font-extrabold text-blue underline underline-offset-4">
                  112
                </a>
                .
              </span>
            </p>
          </div>

          <div className="hero-map relative aspect-square max-w-full overflow-hidden rounded-lg bg-card shadow-lift">
            <svg viewBox="230 200 520 520" className="block size-full" role="img" aria-label={t("mapLabel")}>
              <use href="/maps/prishtina.svg#minor" className="streets-minor fill-none stroke-rule" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <use href="/maps/prishtina.svg#major" className="streets-major fill-none stroke-pencil/45" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
              {pins.map(([category, x, y], index) => (
                <g key={category} transform={`translate(${x} ${y})`} className={`${categoryStyle[category].text}`}>
                  <g className="hero-pin" style={{ "--i": index }}>
                    <path d={pinPath} fill="currentColor" className="stroke-card" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    <circle cy="-20" r="4" className="fill-card" />
                  </g>
                </g>
              ))}
              <g transform="translate(489 353) scale(1.35)">
                <g className="hero-pin" style={{ "--i": 6 }}>
                  <path d={pinPath} className="fill-gold stroke-ink" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                  <circle cy="-20" r="4" className="fill-ink" />
                </g>
              </g>
            </svg>
            <div aria-hidden="true" className="hero-card absolute top-[22%] left-[54%] w-[min(42%,13.75rem)] rotate-[-2deg] rounded-md bg-card p-3 text-xs shadow-lift ring-1 ring-rule sm:p-3.5 sm:text-[0.8125rem]">
              <p className="tabular text-sm font-extrabold sm:text-base">{sample.publicId}</p>
              <p className={`mt-1 flex items-center gap-1.5 font-extrabold ${categoryStyle.infrastructure.text}`}>
                <Icon name="infrastructure" className="size-4" />
                {tc("infrastructure.name")}
              </p>
              <p className="mt-1">Rruga Agim Ramadani</p>
              <p className="tabular mt-0.5 text-pencil">42.6643° N, 21.1650° E</p>
            </div>
            <p className="tabular absolute top-3 left-3 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-pencil">
              42.669° N, 21.153° E
            </p>
            <p className="absolute bottom-3 left-3 rounded-full bg-card px-2.5 py-1 text-[0.6875rem] text-pencil">
              © OpenStreetMap contributors
            </p>
          </div>
        </div>
      </section>

      {/* How it works, told once, by the receipt filling in as you scroll. */}
      <section id="how" aria-labelledby="how-title" className="assemble scroll-mt-4 py-16 lg:py-24">
        <div className={`${wrap} grid gap-10 lg:grid-cols-[minmax(0,1fr)_27.5rem] lg:gap-16`}>
          <div>
            <h2 id="how-title" className="text-3xl font-extrabold tracking-[-0.025em]">
              {t("how.title")}
            </h2>
            <p className="mt-3 max-w-[36rem] text-lg text-pencil">{t("how.sub")}</p>
            <ol className="mt-10 grid gap-10 lg:gap-[18vh] lg:pb-[12vh]">
              {t.raw("how.steps").map((item, index) => (
                <li key={item.title} className={`how-step how-step-${index + 1} grid grid-cols-[2.75rem_1fr] gap-4`}>
                  <span className="tabular flex size-11 items-center justify-center rounded-full bg-wash text-lg font-extrabold text-blue">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-xl font-extrabold">{item.title}</span>
                    <span className="mt-1 block max-w-[32rem] text-pencil">{item.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex justify-center lg:block">
            <div className="lg:sticky lg:top-[12vh] lg:rotate-[-1.5deg]">
              <Receipt {...sample} stamped label={t("sample")} />
            </div>
          </div>
        </div>
      </section>

      {/* With a name or without. */}
      <section aria-labelledby="choice-title" className="bg-card py-16 lg:py-20">
        <div className={wrap}>
          <h2 id="choice-title" className="max-w-[40rem] text-3xl font-extrabold tracking-[-0.025em]">
            {t("choice.title")}
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-12">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-extrabold">
                <Icon name="key" className="size-6 text-blue" />
                {t("choice.anonymousTitle")}
              </h3>
              <p className="mt-2 max-w-[34rem]">{t("choice.anonymousBody")}</p>
              <figure className="relative mt-5 max-w-[22rem] rotate-1 rounded-md border-2 border-dashed border-rule bg-paper px-5 pt-4 pb-5">
                <span aria-hidden="true" className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full bg-card" />
                <span aria-hidden="true" className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full bg-card" />
                <p className="font-stamp text-lg font-black tracking-[0.06em] text-blue uppercase">{ts("keyTitle")}</p>
                <p className="tabular mt-1.5 font-bold break-all text-pencil" aria-hidden="true">
                  3f2b9c1e-7a44-4d0b-9e2f-5c81a6d0b7e4
                </p>
                <figcaption className="mt-2 text-sm text-pencil">{t("choice.keyCaption")}</figcaption>
              </figure>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-xl font-extrabold">
                <Icon name="share" className="size-6 text-blue" />
                {t("choice.namedTitle")}
              </h3>
              <p className="mt-2 max-w-[34rem]">{t("choice.namedBody")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* The seven categories as an index. Each row opens the flow with it chosen. */}
      <section aria-labelledby="categories-title" className="py-16 lg:py-20">
        <div className={wrap}>
          <h2 id="categories-title" className="text-3xl font-extrabold tracking-[-0.025em]">
            {t("categoriesTitle")}
          </h2>
          <p className="mt-3 text-lg text-pencil">{t("categoriesSub")}</p>
          <ul className="mt-8 grid gap-1">
            {categories.map((value) => {
              const style = categoryStyle[value];
              return (
                <li key={value}>
                  <Link
                    href={{ pathname: "/report", query: { category: value } }}
                    className="group grid grid-cols-[3.25rem_1fr] items-center gap-x-4 gap-y-0.5 rounded-md p-3 transition-colors duration-120 hover:bg-card md:grid-cols-[3.25rem_minmax(12rem,16rem)_1fr]"
                  >
                    <span className={`row-span-2 flex size-13 items-center justify-center rounded-md md:row-span-1 ${style.text} ${style.tint}`}>
                      <Icon name={value} className="size-7" />
                    </span>
                    <span className="text-xl font-extrabold tracking-[-0.015em] group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                      {tc(`${value}.name`)}
                    </span>
                    <span className="text-pencil">{tc(`${value}.examples`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* What happens next, and what this platform can't do. */}
      <section aria-labelledby="after-title" className="bg-card py-16 lg:py-20">
        <div className={`${wrap} grid gap-12 lg:grid-cols-[minmax(0,1fr)_24rem]`}>
          <div>
            <h2 id="after-title" className="text-3xl font-extrabold tracking-[-0.025em]">
              {t("after.title")}
            </h2>
            <ol className="mt-8 grid max-w-[38rem]">
              {t.raw("after.steps").map((item, index, all) => (
                <li key={item.title} className="relative grid grid-cols-[2.75rem_1fr] gap-4 pb-8 last:pb-0">
                  {index < all.length - 1 && (
                    <span aria-hidden="true" className="absolute top-11 bottom-0 left-[1.3125rem] w-0.5 bg-rule" />
                  )}
                  <span className="tabular relative flex size-11 items-center justify-center rounded-full bg-blue text-lg font-extrabold text-on-blue">
                    {index + 1}
                  </span>
                  <span className="pt-1.5">
                    <span className="block text-lg font-extrabold">{item.title}</span>
                    <span className="mt-1 block text-pencil">{item.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <aside aria-labelledby="limits-title" className="self-start rounded-lg bg-wash p-6">
            <h3 id="limits-title" className="flex items-center gap-2 text-xl font-extrabold">
              <Icon name="info" className="size-6 text-blue" />
              {t("after.limitsTitle")}
            </h3>
            <p className="mt-3">{t("after.limits")}</p>
            <a href="tel:112" className={`${btn.primary} mt-5 w-full`}>
              <Icon name="phone" className="size-5" />
              {t("after.emergency")} 112
            </a>
          </aside>
        </div>
      </section>

      {latest.length > 0 && (
        <section aria-labelledby="news-title" className="py-16 lg:py-20">
          <div className={wrap}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="news-title" className="text-3xl font-extrabold tracking-[-0.025em]">
                {tn("latest")}
              </h2>
              <Link href="/news" className={btn.link}>
                {tn("all")}
              </Link>
            </div>
            <ul className="mt-8 grid gap-6 md:grid-cols-3">
              {latest.map((post) => (
                <li key={post.id}>
                  <NewsCard post={post} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <InstallBand />
    </>
  );
}
