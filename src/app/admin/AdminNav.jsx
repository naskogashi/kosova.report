import Link from "next/link";
import Wordmark from "../../components/Wordmark";
import { logoutAction } from "./actions";

// Staff navigation shared by every admin page. Owners also see Community, News and Settings.
export default function AdminNav({ current, t, owner = false }) {
  const links = [
    ["/admin", t("Report inbox")],
    ["/admin/stats", t("Statistics")],
    ...(owner
      ? [
          ["/admin/community", t("Community")],
          ["/admin/news", t("News")],
          ["/admin/settings", t("Settings")],
        ]
      : []),
    ["/admin/account", t("My account")],
  ];
  return (
    <nav aria-label={t("Admin panel")} className="flex flex-wrap items-center gap-x-1 gap-y-2">
      <Link href="/admin" className="mr-4 rounded-sm" aria-label={t("Admin panel")}>
        <Wordmark className="text-xl" />
      </Link>
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-bold text-pencil hover:bg-wash hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper"
        >
          {label}
        </Link>
      ))}
      <form action={logoutAction} className="ml-auto">
        <button type="submit" className="inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-bold text-blue hover:bg-wash">
          {t("Sign out")}
        </button>
      </form>
    </nav>
  );
}
