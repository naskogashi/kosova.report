"use client";
import { useTranslations } from "next-intl";
import { Link } from "../../i18n/navigation";
import { btn, wrap } from "../../components/ui";

export default function ErrorPage({ reset }) {
  const t = useTranslations("system");
  return (
    <div className={`${wrap} flex-1 py-14`}>
      <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{t("errorTitle")}</h1>
      <p className="mt-3 max-w-[34rem] text-lg text-pencil">{t("errorBody")}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" onClick={() => reset()} className={btn.primary}>
          {t("retry")}
        </button>
        <Link href="/" className={btn.soft}>
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
