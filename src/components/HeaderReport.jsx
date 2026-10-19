"use client";
import { Link, usePathname } from "../i18n/navigation";
import { btn } from "./ui";

// Desktop Report button; hidden inside the flow it links to. Phones use the bottom bar.
export default function HeaderReport({ label }) {
  const pathname = usePathname();
  if (pathname.startsWith("/report") || pathname.startsWith("/municipality"))
    return null;
  return (
    <Link
      href="/report"
      className={`${btn.primary} ml-2 min-h-11 px-4 text-base max-md:hidden`}
    >
      {label}
    </Link>
  );
}
