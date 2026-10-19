import { getTranslations, setRequestLocale } from "next-intl/server";
import TrackForm from "../../../components/TrackForm";
import { pageMetadata } from "../../../lib/seo";
import { wrap } from "../../../components/ui";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return pageMetadata({ locale, key: "track", internal: "/track" });
}

export default async function TrackPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("track");
  return (
    <div className={`${wrap} py-10 lg:py-16`}>
      <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{t("heading")}</h1>
      <p className="mt-3 max-w-[38rem] text-lg text-pencil">{t("sub")}</p>
      <TrackForm />
    </div>
  );
}
