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
    // A public issue: every report of one problem, with thumbs-up and comments.
    "/incident/[ref]": { sq: "/ceshtja/[ref]", sr: "/problem/[ref]", en: "/issue/[ref]" },
    "/map": { sq: "/harta", sr: "/mapa", en: "/map" },
    "/performance": { sq: "/performanca", sr: "/ucinak", en: "/performance" },
    "/news": { sq: "/lajme", sr: "/vesti", en: "/news" },
    "/news/[slug]": { sq: "/lajme/[slug]", sr: "/vesti/[slug]", en: "/news/[slug]" },
    "/privacy": { sq: "/privatesia", sr: "/privatnost", en: "/privacy" },
  },
});

// hreflang codes. Serbian is tagged with its script so search engines don't assume Cyrillic.
export const hreflang = { sq: "sq", sr: "sr-Latn", en: "en" };
