import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import AdminLanguage from "./AdminLanguage";
import { adminLanguage } from "../../lib/admin-language";
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
  return (
    <html lang={language} className={`${sofia.variable} ${sofiaNarrow.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider
          locale={language}
          messages={await getMessages({ locale: language })}
        >
          <AdminLanguage initialLanguage={language}>{children}</AdminLanguage>
          <Footer locale={language} staff />
          <CookieNotice />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
