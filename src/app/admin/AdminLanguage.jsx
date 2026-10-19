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
        className="flex items-center justify-end gap-2 border-b border-slate-200 bg-white px-5 py-2 text-sm"
      >
        <span className="mr-2 text-slate-500">
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
            className={`min-h-10 rounded-lg px-3 font-semibold ${language === value ? "bg-blue-900 text-white" : "text-blue-900 hover:bg-blue-50"}`}
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
