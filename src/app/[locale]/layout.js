import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../i18n/routing";
import { localizedPath } from "../../i18n/paths";
import { sofia, sofiaNarrow } from "../fonts";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import AppRuntime from "../../components/AppRuntime";
import CookieNotice from "../../components/CookieNotice";
import InstallSheet from "../../components/InstallSheet";
import { ThemeScript } from "../../components/ThemeScript";
import { siteOrigin } from "../../lib/seo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  // Light is the default; ThemeScript switches it to navy after sunset or in dark mode.
  themeColor: "#f6f9fd",
};

export const metadata = {
  metadataBase: new URL(siteOrigin()),
  applicationName: "kosova.report",
  appleWebApp: { capable: true, title: "kosova.report", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { telephone: false },
};

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Warm up the most likely next page: the report flow.
  const speculation = {
    prefetch: [
      { source: "list", urls: [localizedPath("/report", locale)], eagerness: "moderate" },
    ],
  };
  return (
    <html
      lang={locale === "sr" ? "sr-Latn" : locale}
      className={`${sofia.variable} ${sofiaNarrow.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(speculation) }}
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Header locale={locale} />
          <main id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </main>
          <Footer locale={locale} />
          <AppRuntime />
          <CookieNotice />
          <InstallSheet />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
