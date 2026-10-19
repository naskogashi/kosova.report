"use client";
import { useTranslations } from "next-intl";
import { openInstall, useInstall } from "./install";
import { Icon } from "./icons";
import { btn, wrap } from "./ui";

// The install offer on the landing page. Hidden once the app is installed.
export default function InstallBand() {
  const t = useTranslations("install");
  const { installed } = useInstall();
  if (installed) return null;
  return (
    <section aria-labelledby="install-band" className="py-10">
      <div className={wrap}>
        <div className="grid gap-5 rounded-lg bg-ink p-6 text-paper sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 id="install-band" className="text-2xl font-extrabold tracking-[-0.02em]">
              {t("title")}
            </h2>
            <p className="mt-2 max-w-[36rem] opacity-85">{t("body")}</p>
          </div>
          <button type="button" onClick={openInstall} className={`${btn.primary} bg-gold text-[oklch(0.265_0.085_258)] hover:bg-gold`}>
            <Icon name="download" className="size-5" />
            {t("action")}
          </button>
        </div>
      </div>
    </section>
  );
}
