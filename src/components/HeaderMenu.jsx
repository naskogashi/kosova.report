"use client";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "../i18n/navigation";
import { Icon } from "./icons";

// Below wide screens the page links sit behind one Menu button, so the header never wraps.
// On phones the menu also holds the language and theme switches (`extras`). It closes on
// navigation, Escape, or a tap outside.
export default function HeaderMenu({ label, closeLabel, links, extras }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const box = useRef(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);
  return (
    <div ref={box} className="relative xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? closeLabel : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold whitespace-nowrap text-ink hover:bg-wash"
      >
        <Icon name={open ? "close" : "menu"} className="size-5" />
        {label}
      </button>
      {open && (
        <div id="site-menu" className="absolute top-full right-0 z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg bg-card p-2 shadow-lift ring-1 ring-rule">
          <nav aria-label={label}>
            <ul>
              {links.map(([href, text]) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
                    className="flex min-h-12 items-center rounded-md px-3 font-bold text-ink hover:bg-wash aria-[current=page]:text-blue"
                  >
                    {text}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {extras && <div className="mt-2 flex items-center justify-between gap-2 border-t border-rule px-1 pt-3 sm:hidden">{extras}</div>}
        </div>
      )}
    </div>
  );
}
