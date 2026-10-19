import { getTranslations } from "next-intl/server";
import { ogImage, ogSize, ogContentType } from "../../lib/og";

export const size = ogSize;
export const contentType = ogContentType;
export const alt = "kosova.report";

export default async function Image({ params }) {
  const { locale } = await params;
  const meta = await getTranslations({ locale, namespace: "meta" });
  const categories = await getTranslations({ locale, namespace: "categories" });
  const sent = await getTranslations({ locale, namespace: "sent" });
  return ogImage({
    title: meta("slogan"),
    subtitle: meta("home.description"),
    stamp: sent("stamp").toUpperCase(),
    category: categories("infrastructure.name"),
  });
}
