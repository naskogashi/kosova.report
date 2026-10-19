import localFont from "next/font/local";

// Self-hosted, subset to Latin + Latin Extended (ë ç č ć đ š ž). Both are variable.
export const sofia = localFont({
  src: "../fonts/SofiaSans-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-sofia",
  adjustFontFallback: "Arial",
});

// Capitals only. Used on the stamp and the key stub, so it is not preloaded.
export const sofiaNarrow = localFont({
  src: "../fonts/SofiaSansExtraCondensed-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-sofia-narrow",
  preload: false,
});
