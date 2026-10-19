import { getTranslations } from "next-intl/server";
import { Link } from "../../i18n/navigation";
import { btn, wrap } from "../../components/ui";

export default async function NotFound() {
  const t = await getTranslations("system");
  const ts = await getTranslations("shell");
  return (
    <div className={`${wrap} grid flex-1 items-center gap-10 py-14 md:grid-cols-[1fr_20rem]`}>
      <div>
        <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{t("notFoundTitle")}</h1>
        <p className="mt-3 max-w-[32rem] text-lg text-pencil">{t("notFoundBody")}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/" className={btn.primary}>
            {t("goHome")}
          </Link>
          <Link href="/report" className={btn.soft}>
            {ts("reportLong")}
          </Link>
        </div>
      </div>
      {/* A lost pin, off the street grid. */}
      <svg viewBox="380 330 160 160" aria-hidden="true" className="w-full max-w-[20rem] justify-self-center rounded-lg bg-card">
        <use href="/maps/prishtina.svg#minor" className="fill-none stroke-rule" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <use href="/maps/prishtina.svg#major" className="fill-none stroke-pencil/40" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
        <g transform="translate(462 420) rotate(-24) scale(1.6)">
          <path d="M0 0C0 0-11-12.5-11-20a11 11 0 0 1 22 0C11-12.5 0 0 0 0Z" className="fill-gold stroke-ink" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <circle cy="-20" r="4" className="fill-ink" />
        </g>
      </svg>
    </div>
  );
}
