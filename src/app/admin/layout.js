import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import AdminLanguage from "./AdminLanguage";
import { adminLanguage, adminTranslator } from "../../lib/admin-language";
import { currentAdmin } from "../../lib/admin-session";
import AdminNav from "./AdminNav";
import { sofia, sofiaNarrow } from "../fonts";
import Footer from "../../components/Footer";
import CookieNotice from "../../components/CookieNotice";
import { ThemeScript } from "../../components/ThemeScript";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f9fd",
};
export default async function AdminLayout({ children }) {
  const language = await adminLanguage();
  const t = await adminTranslator();
  const admin = await currentAdmin();
  // The scrollbar's space is always reserved, so short and long pages line up.
  return (
    <html lang={language} className={`${sofia.variable} ${sofiaNarrow.variable} [scrollbar-gutter:stable]`}>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider
          locale={language}
          messages={await getMessages({ locale: language })}
        >
          <AdminLanguage initialLanguage={language}>
            {admin && (
              <header className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
                <AdminNav
                  owner={admin.role === "owner"}
                  labels={{
                    panel: t("Admin panel"),
                    inbox: t("Report inbox"),
                    stats: t("Statistics"),
                    community: t("Community"),
                    news: t("News"),
                    settings: t("Settings"),
                    account: t("My account"),
                    signOut: t("Sign out"),
                  }}
                />
              </header>
            )}
            {children}
          </AdminLanguage>
          <Footer locale={language} staff />
          <CookieNotice />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
