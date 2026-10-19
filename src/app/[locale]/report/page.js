import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import ReportFlow from "../../../components/ReportFlow";
import { pageMetadata } from "../../../lib/seo";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return pageMetadata({ locale, key: "report", internal: "/report" });
}

export default async function ReportPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="min-h-[70svh]" />}>
      <ReportFlow />
    </Suspense>
  );
}
