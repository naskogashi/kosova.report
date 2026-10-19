import { setRequestLocale } from "next-intl/server";
import ReportProgress from "../../../../components/ReportProgress";
import { pageMetadata } from "../../../../lib/seo";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    ...(await pageMetadata({ locale, key: "trackReport", noindex: true })),
    referrer: "no-referrer",
  };
}

export default async function TrackReport({ params }) {
  const { locale, publicId } = await params;
  setRequestLocale(locale);
  return <ReportProgress publicId={decodeURIComponent(publicId)} />;
}
