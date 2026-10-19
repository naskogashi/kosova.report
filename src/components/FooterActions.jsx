"use client";
import { openCookies, openInstall, useInstall } from "./install";
import { Icon } from "./icons";

export default function FooterActions({ cookies, install }) {
  const { installed } = useInstall();
  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-bold transition-colors duration-120";
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={openCookies}
        className={`${base} bg-card text-ink hover:text-blue`}
      >
        {cookies}
      </button>
      {!installed && (
        <button
          type="button"
          onClick={openInstall}
          className={`${base} bg-blue text-on-blue hover:bg-blue-press`}
        >
          <Icon name="download" className="size-5" />
          {install}
        </button>
      )}
    </div>
  );
}
