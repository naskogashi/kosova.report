import { getTranslations } from "next-intl/server";
import { Link } from "../i18n/navigation";
import LanguageSwitch from "./LanguageSwitch";
import ThemeMenu from "./ThemeMenu";
import HeaderReport from "./HeaderReport";
import HeaderBrand from "./HeaderBrand";
import HeaderMenu from "./HeaderMenu";
import { Icon } from "./icons";
import { wrap } from "./ui";

// One row at every width: on wide screens the links sit inline; below that they move behind a
// Menu button, and on phones the language and theme switches move into that menu too.
export default async function Header({ locale }) {
  const t = await getTranslations({ locale, namespace: "shell" });
  const links = [
    ["/map", t("map")],
    ["/performance", t("performance")],
    ["/news", t("news")],
    ["/track", t("track")],
  ];
  const language = <LanguageSwitch label={t("language")} names={{ sq: "Shqip", sr: "Srpski", en: "English" }} />;
  const theme = <ThemeMenu labels={t.raw("theme")} />;
  return (
    <header className="relative z-20">
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-ink px-4 py-3 font-bold text-paper focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t("skip")}
      </a>
      <div className={`${wrap} flex min-h-16 items-center gap-x-2 py-2 sm:gap-x-3`}>
        <HeaderBrand label={t("home")} />
        <p className="hidden items-center gap-1.5 text-sm font-bold whitespace-nowrap text-ink xl:flex">
          <Icon name="pin" className="size-4 text-blue" />
          {t("city")}
        </p>
        <nav aria-label={t("home")} className="ml-auto hidden xl:block">
          <ul className="flex items-center gap-1 text-sm font-bold">
            {links.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center rounded-full px-3 whitespace-nowrap text-ink hover:bg-wash">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1 xl:ml-2">
          <HeaderMenu label={t("menu")} closeLabel={t("menuClose")} links={links} extras={<>{language}{theme}</>} />
          <div className="flex items-center gap-0.5 max-sm:hidden sm:gap-1">
            {theme}
            {language}
          </div>
          <HeaderReport label={t("reportLong")} />
        </div>
      </div>
    </header>
  );
}
