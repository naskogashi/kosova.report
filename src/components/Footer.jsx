import { getTranslations } from "next-intl/server";
import { Link } from "../i18n/navigation";
import { branding } from "../lib/branding";
import ThemedLogo from "./ThemedLogo";
import FooterActions from "./FooterActions";
import { Icon } from "./icons";
import { wrap } from "./ui";

// Partners, the CIVICUS DDI line and the CODON credit.
// The DDI logo itself is in the header of the home and report pages (HeaderBrand).
// The public site adds page links; the staff panel (`staff`) leaves them out.
export default async function Footer({ locale, staff = false }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const ts = await getTranslations({ locale, namespace: "shell" });
  const links = staff
    ? null
    : [
        ["/map", ts("map")],
        ["/news", ts("news")],
        ["/track", ts("track")],
        ["/privacy", ts("privacy")],
      ];
  const partners = branding.filter((asset) => asset.key !== "codon");
  const codon = branding.find((asset) => asset.key === "codon");
  return (
    <footer className="mt-auto bg-card pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className={`${wrap} pt-10`}>
        <ul
          aria-label={t("partners")}
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5"
        >
          {partners.map((asset) => (
            <li key={asset.key} className={`flex h-14 items-center justify-center ${asset.wide ? "w-56" : "w-28"}`}>
              {asset.key === "sbunker" ? (
                <a
                  href="https://sbunker.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Sbunker (${t("newTab")})`}
                  className="rounded-sm"
                >
                  <ThemedLogo asset={asset} className="max-h-12 max-w-full object-contain" />
                </a>
              ) : (
                <ThemedLogo asset={asset} className="max-h-11 max-w-full object-contain" />
              )}
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-6 max-w-[36rem] text-center text-sm text-pencil">
          {t("support")}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 border-t border-rule pt-6 text-center text-xs text-pencil">
          <a
            href="https://codon.fi"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`CODON (${t("newTab")})`}
            className="codon-link flex flex-col items-center rounded-sm"
          >
            <ThemedLogo asset={codon} className="h-9 w-auto max-w-28 object-contain" />
            <span aria-hidden="true" className="codon-underline mt-1 block h-0.5 w-full rounded-full bg-gold" />
          </a>
          <span lang="en">{t("codon")}</span>
        </div>
        {links && (
          <nav aria-label={t("links")} className="mt-8">
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-bold">
              {links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="inline-flex min-h-11 items-center text-blue underline-offset-4 hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="mt-6 grid gap-4 rounded-md bg-wash p-4 text-sm sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <p className="flex items-start gap-2.5">
            <Icon name="info" className="mt-0.5 size-5 shrink-0 text-blue" />
            <span>
              {t("disclaimer")}{" "}
              <span className="whitespace-nowrap font-bold">
                {t("emergency")}{" "}
                <a href="tel:112" className="tabular text-blue underline underline-offset-4">
                  112
                </a>
              </span>
            </span>
          </p>
          <FooterActions cookies={t("cookies")} install={t("install")} />
        </div>
      </div>
    </footer>
  );
}
