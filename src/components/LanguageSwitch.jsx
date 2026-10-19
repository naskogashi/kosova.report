"use client";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "../i18n/navigation";
import { routing } from "../i18n/routing";

// SQ / SR / EN. Keeps the current page and cross-fades the text with a view transition.
export default function LanguageSwitch({ label, names }) {
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function choose(next) {
    if (next === locale) return;
    const go = () =>
      startTransition(() =>
        router.replace(
          { pathname, params },
          { locale: next, scroll: false },
        ),
      );
    if (
      document.startViewTransition &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      document.startViewTransition(go);
    else go();
  }
  return (
    <nav aria-label={label}>
      <ul
        className="flex rounded-full bg-wash p-1"
        aria-busy={pending || undefined}
      >
        {routing.locales.map((value) => (
          <li key={value}>
            <button
              type="button"
              lang={value}
              aria-current={value === locale ? "true" : undefined}
              aria-label={names[value]}
              onClick={() => choose(value)}
              className="min-h-10 min-w-10 rounded-full px-2 text-sm sm:min-w-11 sm:px-2.5 font-bold text-pencil transition-colors duration-120 hover:text-ink aria-[current=true]:bg-card aria-[current=true]:text-blue aria-[current=true]:shadow-soft"
            >
              {value.toUpperCase()}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
