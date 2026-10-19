"use client";
import { useEffect, useId, useState } from "react";
import { Icon } from "./icons";

const modes = ["auto", "light", "dark", "sun"];
const icons = { auto: "auto", light: "sun", dark: "moon", sun: "contrast" };

// Theme picker in a native popover. Names come translated from the shell messages.
export default function ThemeMenu({ labels }) {
  const id = useId();
  const [mode, setMode] = useState("auto");
  useEffect(() => {
    const sync = () => setMode(window.krTheme?.mode() || "auto");
    sync();
    window.addEventListener("kr:theme", sync);
    return () => window.removeEventListener("kr:theme", sync);
  }, []);
  function choose(next) {
    window.krTheme?.set(next);
    setMode(next);
    document.getElementById(id)?.hidePopover?.();
  }
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors duration-120 hover:bg-wash"
      >
        <Icon name={icons[mode]} className="size-6" />
        <span className="sr-only">
          {labels.title}: {labels[mode]}
        </span>
      </button>
      <div
        id={id}
        popover="auto"
        className="theme-pop m-0 w-72 rounded-md border-0 bg-card p-2 text-ink shadow-lift ring-1 ring-rule"
      >
        <p className="px-3 pt-2 pb-1 text-sm font-bold text-pencil">{labels.title}</p>
        <ul role="radiogroup" aria-label={labels.title} className="grid">
          {modes.map((value) => (
            <li key={value}>
              <button
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => choose(value)}
                className="flex min-h-12 w-full items-center gap-3 rounded-sm px-3 text-left hover:bg-wash aria-checked:text-blue"
              >
                <Icon name={icons[value]} className="size-5 shrink-0" />
                <span className="flex-1">
                  <span className="block font-bold">{labels[value]}</span>
                  {labels[`${value}Hint`] && (
                    <span className="block text-xs text-pencil">{labels[`${value}Hint`]}</span>
                  )}
                </span>
                {mode === value && <Icon name="check" className="size-5" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
