import { getTranslations } from "next-intl/server";
import { Link } from "../i18n/navigation";
import LanguageSwitch from "./LanguageSwitch";
import ThemeMenu from "./ThemeMenu";
import HeaderReport from "./HeaderReport";
import HeaderBrand from "./HeaderBrand";
import { Icon } from "./icons";
import { wrap } from "./ui";

export default async function Header({ locale }) {
  const t = await getTranslations({ locale, namespace: "shell" });
  return (
    <header className="relative z-20">
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-ink px-4 py-3 font-bold text-paper focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t("skip")}
      </a>
      <div
        className={`${wrap} flex min-h-16 items-center gap-x-3 py-2 sm:gap-x-4`}
      >
        <HeaderBrand label={t("home")} />
        <p className="hidden items-center gap-1.5 text-sm text-pencil md:flex">
          <Icon name="pin" className="size-4 text-blue" />
          <span className="font-bold text-ink">{t("city")}</span>
          <span>{t("citySoon")}</span>
        </p>
        <nav aria-label={t("home")} className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1 text-sm font-bold">
            {[
              ["/map", t("map")],
              ["/performance", t("performance")],
              ["/news", t("news")],
              ["/track", t("track")],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center rounded-full px-3 text-ink hover:bg-wash">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1 lg:ml-2">
          <ThemeMenu labels={t.raw("theme")} />
          <LanguageSwitch
            label={t("language")}
            names={{ sq: "Shqip", sr: "Srpski", en: "English" }}
          />
          <HeaderReport label={t("reportLong")} />
        </div>
      </div>
    </header>
  );
}
