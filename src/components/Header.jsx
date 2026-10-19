import { getTranslations } from "next-intl/server";
import { Link } from "../i18n/navigation";
import Wordmark from "./Wordmark";
import LanguageSwitch from "./LanguageSwitch";
import ThemeMenu from "./ThemeMenu";
import HeaderReport from "./HeaderReport";
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
        <Link href="/" aria-label={t("home")} className="rounded-sm">
          <Wordmark className="text-[1.25rem] sm:text-[1.4rem]" />
        </Link>
        <p className="hidden items-center gap-1.5 text-sm text-pencil md:flex">
          <Icon name="pin" className="size-4 text-blue" />
          <span className="font-bold text-ink">{t("city")}</span>
          <span>{t("citySoon")}</span>
        </p>
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
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
