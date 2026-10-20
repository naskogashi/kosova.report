// Partner and project logos. `fallback` is the original file behind /api/branding (R2).
// The site shows the web-sized copies in /logos/themed: transparent logos have a `dark`
// version with light text for the dark theme; logos that aren't transparent are `boxed`
// in a soft white card instead, on every theme. `wide` logos get a double-width slot.
export const branding = [
  { key: "civicus", name: "CIVICUS", fallback: "/logos/civicus.png", light: "/logos/themed/civicus.png", boxed: true },
  {
    key: "metamorphosis",
    name: "Metamorphosis Foundation",
    fallback: "/logos/metamorphosis.png",
    light: "/logos/themed/metamorphosis.png",
    dark: "/logos/themed/metamorphosis-dark.png",
    wide: true,
  },
  {
    key: "techsoup",
    name: "TechSoup",
    fallback: "/logos/techsoup.png",
    light: "/logos/themed/techsoup.png",
    dark: "/logos/themed/techsoup-dark.png",
  },
  {
    key: "digital-activism",
    name: "Digital Activism Program",
    fallback: "/logos/digital-activism.png",
    light: "/logos/themed/digital-activism.png",
    boxed: true,
  },
  {
    key: "sbunker",
    name: "Sbunker",
    fallback: "/logos/sbunker.png",
    light: "/logos/themed/sbunker.png",
    dark: "/logos/themed/sbunker-dark.png",
  },
  {
    key: "codon",
    name: "CODON",
    fallback: "/logos/codon.webp",
    light: "/logos/themed/codon.png",
    dark: "/logos/themed/codon-dark.png",
  },
];

// The donor, shown in the header of the home and report pages.
export const donor = {
  key: "ddi",
  name: "Digital Democracy Initiative",
  light: "/logos/themed/ddi.png",
  dark: "/logos/themed/ddi-dark.png",
};
