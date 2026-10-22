"use client";
import { Link, usePathname } from "../i18n/navigation";

// The inline page links on wide screens. The current page is marked the same way as in the
// Menu, so the header shows where you are on every page.
export default function HeaderNav({ label, links }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="ml-auto hidden xl:block">
      <ul className="flex items-center gap-1 text-sm font-bold">
        {links.map(([href, text]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-full px-3 whitespace-nowrap text-ink hover:bg-wash aria-[current=page]:bg-wash aria-[current=page]:text-blue"
            >
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
