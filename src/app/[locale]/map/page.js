import { getTranslations, setRequestLocale } from "next-intl/server";
import TransparencyMap from "../../../components/TransparencyMap";
import { Icon } from "../../../components/icons";
import { pageMetadata } from "../../../lib/seo";
import { wrap } from "../../../components/ui";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return pageMetadata({ locale, key: "map", internal: "/map" });
}

// The public transparency map, for citizens, civil society and journalists.
export default async function MapPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("map");
  return (
    <div className={`${wrap} py-10 lg:py-14`}>
      <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      <p className="mt-3 max-w-[42rem] text-lg text-pencil">{t("intro")}</p>
      <p className="mt-3 flex max-w-[42rem] items-start gap-2 text-sm text-pencil">
        <Icon name="key" className="mt-0.5 size-4 shrink-0" />
        {t("privacy")}
      </p>
      <TransparencyMap />
    </div>
  );
}
