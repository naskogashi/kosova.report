// Keep the public slogan and browser title consistent in all supported languages.
export const slogans = {
  sq: "Zëri yt. Një qytet më i mirë.",
  sr: "Vaš glas. Bolji grad.",
  en: "Your voice. A better city.",
};
export const siteTitle = (language = "sq") =>
  `kosova.report — ${slogans[language] || slogans.sq}`;
