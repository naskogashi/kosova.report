"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Wordmark from "../../components/Wordmark";
import { logoutAction } from "./actions";

// Staff navigation, drawn once by the admin layout so it never moves between pages.
// Owners also see Community, News and Settings. The current page comes from the URL.
export default function AdminNav({ labels, owner = false }) {
  const pathname = usePathname();
  const links = [
    ["/admin", labels.inbox],
    ["/admin/stats", labels.stats],
    ...(owner
      ? [
          ["/admin/community", labels.community],
          ["/admin/news", labels.news],
          ["/admin/settings", labels.settings],
        ]
      : []),
    ["/admin/account", labels.account],
  ];
  const current = (href) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label={labels.panel} className="flex flex-wrap items-center gap-x-1 gap-y-2">
      <Link href="/admin" className="mr-4 rounded-sm" aria-label={labels.panel}>
        <Wordmark className="text-xl" />
      </Link>
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={current(href) ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-bold text-pencil hover:bg-wash hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper"
        >
          {label}
        </Link>
      ))}
      <form action={logoutAction} className="ml-auto">
        <button type="submit" className="inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-bold text-blue hover:bg-wash">
          {labels.signOut}
        </button>
      </form>
    </nav>
  );
}
