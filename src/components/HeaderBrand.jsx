"use client";
import { Link, usePathname } from "../i18n/navigation";
import Wordmark from "./Wordmark";
import ThemedLogo from "./ThemedLogo";
import { donor } from "../lib/branding";

// Top-left of the header. On the home and report pages the donor's logo takes this place
// (the kosova.report logo then leads the home page title); elsewhere it's our wordmark.
export default function HeaderBrand({ label }) {
  const pathname = usePathname();
  const showDonor = pathname === "/" || pathname === "/report";
  return (
    <Link
      href="/"
      aria-label={showDonor ? `${donor.name} · ${label}` : label}
      className="shrink-0 rounded-sm"
    >
      {showDonor ? (
        <ThemedLogo asset={donor} alt="" className="h-[30px] w-auto sm:h-[34px]" />
      ) : (
        <Wordmark className="text-[1.25rem] sm:text-[1.4rem]" />
      )}
    </Link>
  );
}
