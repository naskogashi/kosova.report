"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Sheet from "./Sheet";
import { Icon } from "./icons";
import { btn } from "./ui";
import { promptInstall, useInstall } from "./install";

export default function InstallSheet() {
  const t = useTranslations("install");
  const { canPrompt, ios } = useInstall();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("kr:open-install", show);
    return () => window.removeEventListener("kr:open-install", show);
  }, []);
  async function install() {
    await promptInstall();
    setOpen(false);
  }
  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={t("title")}
      titleId="install-title"
      closeLabel={t("done")}
    >
      <p className="mt-2 text-pencil">{t("body")}</p>
      {canPrompt ? (
        <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto]">
          <button type="button" onClick={install} className={btn.primary}>
            <Icon name="download" className="size-5" />
            {t("action")}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={btn.soft}
          >
            {t("later")}
          </button>
        </div>
      ) : ios ? (
        <div className="mt-5 rounded-md bg-wash p-4">
          <h3 className="font-bold">{t("iosTitle")}</h3>
          <ol className="mt-3 grid gap-3">
            {t.raw("iosSteps").map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="tabular inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-sm font-extrabold text-blue">
                  {index + 1}
                </span>
                <span className="pt-0.5">
                  {step}
                  {index === 1 && (
                    <Icon
                      name="share"
                      className="ml-1.5 inline size-5 align-[-4px] text-blue"
                      title=""
                    />
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-5 rounded-md bg-wash p-4">{t("otherHelp")}</p>
      )}
    </Sheet>
  );
}
