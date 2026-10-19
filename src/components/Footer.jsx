"use client";
import { branding } from "../lib/branding";
import useLanguage from "./useLanguage";
export default function Footer() {
  const language = useLanguage();
  const disclaimer = {
    sq: "Ky aktivitet mbështetet nga CIVICUS Digital Democracy Initiative (DDI).",
    sr: "Ovu aktivnost podržava CIVICUS Digital Democracy Initiative (DDI).",
    en: "This activity is supported by the CIVICUS Digital Democracy Initiative (DDI).",
  };
  return (
    <footer className="mt-auto w-full border-t border-slate-200 bg-white px-4 py-8 text-slate-600">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-x-auto pb-4">
          <ul
            aria-label="Project partners"
            className="flex min-w-max items-center justify-center gap-8 sm:min-w-0"
          >
            {branding
              .filter((asset) => asset.key !== "codon")
              .map((asset) => (
                <li
                  key={asset.key}
                  className="flex h-16 w-28 shrink-0 items-center justify-center"
                >
                  {asset.key === "sbunker" ? (
                    <a
                      href="https://sbunker.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Sbunker (opens in a new tab)"
                    >
                      <img
                        src={`/api/branding/${asset.key}`}
                        alt={asset.name}
                        className="max-h-12 max-w-full object-contain"
                      />
                    </a>
                  ) : (
                    <img
                      src={`/api/branding/${asset.key}`}
                      alt={asset.name}
                      className="max-h-12 max-w-full object-contain"
                    />
                  )}
                </li>
              ))}
          </ul>
        </div>
        <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed">
          {disclaimer[language]}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 border-t border-slate-100 pt-5 text-center text-xs">
          <a
            href="https://codon.fi"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="CODON (opens in a new tab)"
          >
            <img
              src="/api/branding/codon"
              alt="CODON"
              className="h-9 w-auto max-w-28 object-contain"
            />
          </a>
          <span>in co-operation with CODON a part of Progon LLC.</span>
        </div>
      </div>
    </footer>
  );
}
