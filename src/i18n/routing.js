import { defineRouting } from "next-intl/routing";

// Albanian is the default and x-default. Serbian is Latin script only.
export const routing = defineRouting({
  locales: ["sq", "sr", "en"],
  defaultLocale: "sq",
  localePrefix: "always",
  localeCookie: { name: "kr-locale", maxAge: 60 * 60 * 24 * 365 },
  pathnames: {
    "/": "/",
    "/report": { sq: "/raporto", sr: "/prijavi", en: "/report" },
    "/report/sent": {
      sq: "/raporto/u-dergua",
      sr: "/prijavi/poslato",
      en: "/report/sent",
    },
    "/track": { sq: "/gjurmo", sr: "/prati", en: "/track" },
    "/track/[publicId]": {
      sq: "/gjurmo/[publicId]",
      sr: "/prati/[publicId]",
      en: "/track/[publicId]",
    },
    "/municipality/[publicId]": "/municipality/[publicId]",
  },
});

// hreflang codes. Serbian is tagged with its script so search engines don't assume Cyrillic.
export const hreflang = { sq: "sq", sr: "sr-Latn", en: "en" };
