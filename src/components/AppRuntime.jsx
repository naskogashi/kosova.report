"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "../i18n/navigation";
import { btn } from "./ui";

// Registers the service worker and shows the thumb-zone Report button on phones.
export default function AppRuntime() {
  const t = useTranslations("shell");
  const pathname = usePathname();
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  const hidden =
    pathname.startsWith("/report") || pathname.startsWith("/municipality");
  if (hidden) return null;
  return (
    <>
      <div aria-hidden="true" className="h-24 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-30 bg-paper/95 px-[max(1rem,env(safe-area-inset-left))] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-1px_0_var(--color-rule)] md:hidden">
        <Link href="/report" className={`${btn.primary} w-full`}>
          {t("reportLong")}
        </Link>
      </div>
    </>
  );
}
