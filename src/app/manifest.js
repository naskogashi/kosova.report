// PWA manifest. "New report" is a home-screen shortcut straight into the flow.
export default function manifest() {
  return {
    name: "kosova.report",
    short_name: "kosova.report",
    description:
      "Raporto problemet e qytetit me foto dhe vendndodhje. Prijavite probleme u gradu. Report problems in your city.",
    id: "/",
    start_url: "/sq",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "sq",
    background_color: "#f6f9fd",
    theme_color: "#f6f9fd",
    categories: ["government", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Same mark scaled into the 80% safe zone, so Android can crop it to any shape.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Raporto një problem", short_name: "Raporto", url: "/sq/raporto", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Gjej raportin tim", short_name: "Gjurmo", url: "/sq/gjurmo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
