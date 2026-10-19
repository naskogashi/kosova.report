"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { translateAdmin } from "../../lib/admin-translations";
import { siteTitle } from "../../lib/site-branding";
const LanguageContext = createContext("en");
export const useAdminText = () => {
  const language = useContext(LanguageContext);
  return (text) => translateAdmin(text, language);
};
export default function AdminLanguage({ initialLanguage, children }) {
  const [language, setLanguage] = useState(initialLanguage);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = language;
    const label =
      {
        "/admin": "Admin panel",
        "/admin/login": "Staff sign-in",
        "/admin/settings": "Platform settings",
        "/admin/account": "My account",
        "/admin/stats": "Statistics",
      }[pathname] || "Admin panel";
    document.title = `${translateAdmin(label, language)} | ${siteTitle(language)}`;
  }, [language, pathname]);
  function change(value) {
    document.cookie = `kr-admin-language=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setLanguage(value);
    router.refresh();
  }
  return (
    <LanguageContext.Provider value={language}>
      <nav
        aria-label="Admin language / Gjuha e administrimit"
        className="flex items-center justify-end gap-2 px-4 pt-3 text-sm sm:px-6"
      >
        <span className="mr-1 text-pencil">
          {language === "sq" ? "Gjuha e panelit" : "Admin language"}
        </span>
        {[
          ["sq", "Shqip"],
          ["en", "English"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={language === value}
            onClick={() => change(value)}
            className={`min-h-10 rounded-full px-3.5 font-bold ${language === value ? "bg-card text-blue shadow-soft" : "text-pencil hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div lang={language} className="flex flex-1 flex-col">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}
