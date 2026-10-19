import { setRequestLocale } from "next-intl/server";
import SentView from "../../../../components/SentView";
import { pageMetadata } from "../../../../lib/seo";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    ...(await pageMetadata({ locale, key: "sent", internal: "/report/sent", noindex: true })),
    referrer: "no-referrer",
  };
}

export default async function SentPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SentView />;
}
