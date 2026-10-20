import { getTranslations } from "next-intl/server";
import { wrap } from "./ui";

// The donor's logo, on top of the home and report pages only.
export default async function DonorBand({ locale }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  return (
    <aside aria-label={t("supportedBy")} className="bg-card shadow-[0_1px_0_var(--color-rule)]">
      <div className={`${wrap} flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 py-2.5`}>
        <span className="text-xs font-bold tracking-[0.08em] text-pencil uppercase">{t("supportedBy")}</span>
        <span className="rounded-sm dark:bg-[oklch(0.97_0.008_255)] dark:px-2 dark:py-1">
          <img src="/logos/ddi.png" alt="Digital Democracy Initiative" width="1916" height="387" className="h-8 w-auto sm:h-9" />
        </span>
      </div>
    </aside>
  );
}
