import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../../i18n/routing";
import { sofia, sofiaNarrow } from "../../fonts";

// Widgets other sites embed in an iframe: no header, footer, cookie notice or app install.
export const metadata = { robots: { index: false, follow: false } };

export default async function EmbedLayout({ children, params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale === "sr" ? "sr-Latn" : locale} className={`${sofia.variable} ${sofiaNarrow.variable}`}>
      <body className="bg-paper p-3 text-ink">{children}</body>
    </html>
  );
}
