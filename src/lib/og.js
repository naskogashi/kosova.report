import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Shared look for every link preview: the sky band, the wordmark with the gold pin,
// a slice of Prishtina's real streets and a small stamped receipt.
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

let assets;
async function load() {
  if (assets) return assets;
  const root = process.cwd();
  const [regular, bold, narrow, svg] = await Promise.all([
    readFile(path.join(root, "src/fonts/pdf/SofiaSans-Regular.ttf")),
    readFile(path.join(root, "src/fonts/pdf/SofiaSans-Bold.ttf")),
    readFile(path.join(root, "src/fonts/pdf/SofiaSansExtraCondensed-Black.ttf")),
    readFile(path.join(root, "public/maps/prishtina.svg"), "utf8"),
  ]);
  const d = (id) => svg.match(new RegExp(`id="${id}"[^>]*d="([^"]+)"`))?.[1] || "";
  // A crop around Rruga Agim Ramadani, drawn once as an inline SVG image.
  const streets = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="300 220 420 330"><path d="${d("minor")}" fill="none" stroke="#c9d6e6" stroke-width="1.4"/><path d="${d("major")}" fill="none" stroke="#9fb1c8" stroke-width="3.2"/></svg>`;
  assets = {
    fonts: [
      { name: "Sofia", data: regular, weight: 400, style: "normal" },
      { name: "Sofia", data: bold, weight: 800, style: "normal" },
      { name: "SofiaNarrow", data: narrow, weight: 900, style: "normal" },
    ],
    streets: `data:image/svg+xml;base64,${Buffer.from(streets).toString("base64")}`,
  };
  return assets;
}

export async function ogImage({ title, subtitle, stamp = "DËRGUAR", category = "Infrastrukturë" }) {
  const { fonts, streets } = await load();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#e2f0ff", fontFamily: "Sofia", color: "#06244d" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 64px 72px", width: 660 }}>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            kosova
            <svg width="16" height="22" viewBox="0 0 10 14" style={{ margin: "0 2px 6px" }}>
              <path d="M5 14C5 14 0 8 0 5a5 5 0 0 1 10 0c0 3-5 9-5 9Z" fill="#e4b756" />
            </svg>
            report
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: title.length > 40 ? 58 : 70, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>{title}</div>
            {subtitle && <div style={{ marginTop: 22, fontSize: 28, lineHeight: 1.35, color: "#515e72" }}>{subtitle}</div>}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#515e72" }}>kosova.report</div>
        </div>
        <div style={{ position: "relative", display: "flex", flex: 1 }}>
          <img src={streets} width={540} height={630} style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              left: 70,
              top: 150,
              width: 360,
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
              borderRadius: 22,
              padding: "26px 28px",
              boxShadow: "0 24px 50px -20px rgba(21,79,195,0.35)",
              transform: "rotate(-3deg)",
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 800 }}>PR-2026-000418</div>
            <div style={{ display: "flex", marginTop: 16 }}>
              <div style={{ display: "flex", padding: "6px 14px", borderRadius: 10, border: "2px solid #a9592b", color: "#a9592b", background: "#f7ece6", fontSize: 22, fontWeight: 800 }}>
                {category}
              </div>
            </div>
            <div style={{ marginTop: 18, height: 2, background: "#d8e1ec" }} />
            <div style={{ marginTop: 16, height: 2, background: "#d8e1ec" }} />
            <div style={{ marginTop: 16, height: 2, width: 200, background: "#d8e1ec" }} />
            <div
              style={{
                position: "absolute",
                right: -26,
                bottom: -36,
                width: 132,
                height: 132,
                borderRadius: 999,
                border: "5px solid #916016",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: "rotate(-12deg)",
                color: "#916016",
                fontFamily: "SofiaNarrow",
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              {stamp}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...ogSize, fonts },
  );
}
