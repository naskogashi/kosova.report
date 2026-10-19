import { readFileSync } from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { localizedCityName } from "./municipality-names.js";

// The PDF proof is the same object as the on-screen receipt: same faces, same
// category colour, the street snippet with the gold pin, the citizen's words on
// ruled lines and the round stamp. It never contains the private key; the QR
// code opens the lookup page with the report number filled in.

const root = process.cwd();
const fonts = {};
function font(file) {
  fonts[file] ||= readFileSync(path.join(root, "src/fonts/pdf", file)).toString("base64");
  return fonts[file];
}
const messages = {};
function words(language) {
  const lang = ["sq", "sr", "en"].includes(language) ? language : "sq";
  messages[lang] ||= JSON.parse(readFileSync(path.join(root, "src/messages", `${lang}.json`), "utf8"));
  return { lang, m: messages[lang] };
}

// sRGB equivalents of the design tokens in globals.css.
const color = {
  ink: [6, 36, 77],
  pencil: [81, 94, 114],
  rule: [216, 225, 236],
  wash: [226, 240, 255],
  blue: [21, 79, 195],
  gold: [228, 183, 86],
  stamp: [145, 96, 22],
  white: [255, 255, 255],
};
const category = {
  infrastructure: [169, 89, 43],
  environment: [60, 120, 71],
  public_services: [35, 116, 134],
  administration: [107, 81, 143],
  health: [166, 75, 81],
  education: [120, 113, 33],
  safety: [65, 110, 141],
};
const tint = (rgb, amount = 0.12) => rgb.map((c) => Math.round(255 - (255 - c) * amount));

// Street linework, same source and projection as the on-screen receipt (src/lib/city-map.js).
let streets;
function cityStreets() {
  if (streets !== undefined) return streets;
  try {
    const svg = readFileSync(path.join(root, "public/maps/prishtina.svg"), "utf8");
    const parse = (id) => {
      const d = svg.match(new RegExp(`id="${id}"[^>]*d="([^"]+)"`))?.[1] || "";
      return d
        .split("M")
        .filter(Boolean)
        .map((part) => part.split("L").map((pair) => pair.trim().split(/\s+/).map(Number)));
    };
    streets = { minor: parse("minor"), major: parse("major") };
  } catch {
    streets = null;
  }
  return streets;
}
const map = { west: 21.143, north: 42.676, east: 21.188, south: 42.65, scale: 1000 / (0.045 * 0.7353) };
const project = (lat, lng) => [(lng - map.west) * 0.7353 * map.scale, (map.north - lat) * map.scale];

const clean = (value) =>
  String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

export function createReportPDF(report) {
  const { lang, m } = words(report.language);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("SofiaSans-Regular.ttf", font("SofiaSans-Regular.ttf"));
  doc.addFileToVFS("SofiaSans-Bold.ttf", font("SofiaSans-Bold.ttf"));
  doc.addFileToVFS("SofiaNarrow.ttf", font("SofiaSansExtraCondensed-Black.ttf"));
  doc.addFont("SofiaSans-Regular.ttf", "Sofia", "normal");
  doc.addFont("SofiaSans-Bold.ttf", "Sofia", "bold");
  doc.addFont("SofiaNarrow.ttf", "SofiaNarrow", "normal");
  doc.setProperties({
    title: `${m.pdf.title} ${report.public_id}`,
    author: "kosova.report",
    subject: m.pdf.title,
    language: lang,
  });

  const origin = (() => {
    try {
      return new URL(process.env.APP_URL || "https://kosova.report").origin;
    } catch {
      return "https://kosova.report";
    }
  })();
  const trackPath = { sq: "gjurmo", sr: "prati", en: "track" }[lang];
  const trackURL = `${origin}/${lang}/${trackPath}/${encodeURIComponent(report.public_id)}`;
  const cityName = clean(localizedCityName(report.city_name || report.city_code, lang));
  const created = new Date(report.created_at);
  const dateText = new Intl.DateTimeFormat({ sq: "sq-AL", sr: "sr-Latn-RS", en: "en-GB" }[lang], {
    timeZone: "Europe/Belgrade",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(created);
  const dayText = new Intl.DateTimeFormat({ sq: "sq-AL", sr: "sr-Latn-RS", en: "en-GB" }[lang], {
    timeZone: "Europe/Belgrade",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(created);
  const accent = category[report.category] || color.ink;
  const L = 18;
  const R = 192;
  const text = (value, x, y, options) =>
    doc.text(Array.isArray(value) ? value.map(clean) : clean(value), x, y, options);
  const set = (family, style, size, rgb) => {
    doc.setFont(family, style);
    doc.setFontSize(size);
    doc.setTextColor(...rgb);
  };

  function header() {
    // Wordmark: the full stop is a gold pin.
    set("Sofia", "bold", 17, color.ink);
    const k = doc.getTextWidth("kosova");
    text("kosova", L, 22);
    const px = L + k + 1.6;
    doc.setFillColor(...color.gold);
    doc.circle(px, 18.6, 1.25, "F");
    doc.triangle(px - 1.1, 19.2, px + 1.1, 19.2, px, 22, "F");
    text("report", px + 1.7, 22);
    set("Sofia", "normal", 9.5, color.pencil);
    text(`${m.receipt.kind}, ${cityName}`, R, 22, { align: "right" });
    doc.setDrawColor(...color.rule);
    doc.setLineWidth(0.3);
    doc.line(L, 28, R, 28);
  }
  header();

  // Report number, large, with the stamp beside it.
  set("Sofia", "normal", 9.5, color.pencil);
  text(m.pdf.number, L, 40);
  set("Sofia", "bold", 26, color.ink);
  text(report.public_id, L, 51);

  // Category badge in its accent colour.
  const categoryName = m.categories[report.category]?.name || clean(report.category);
  set("Sofia", "bold", 12, accent);
  const badgeW = doc.getTextWidth(categoryName) + 10;
  doc.setFillColor(...tint(accent));
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.45);
  doc.roundedRect(L, 58, badgeW, 9, 2, 2, "FD");
  text(categoryName, L + 5, 64.2);

  // Fields on the left, street snippet on the right.
  let y = 80;
  const field = (label, value, sub) => {
    set("Sofia", "normal", 9.5, color.pencil);
    text(label, L, y);
    set("Sofia", "bold", 11, color.ink);
    text(value, L + 30, y);
    if (sub) {
      set("Sofia", "normal", 9, color.pencil);
      text(sub, L + 30, y + 5);
      y += 5;
    }
    y += 9;
  };
  const lat = Number(report.latitude);
  const lng = Number(report.longitude);
  field(m.receipt.place, cityName, `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`);
  field(m.receipt.submitted, dateText);
  if (report.is_anonymous !== undefined && report.is_anonymous !== null)
    field(m.receipt.mode, Number(report.is_anonymous) ? m.receipt.anonymous : m.receipt.named);
  field(m.receipt.photos, fill(m.receipt.photoCount.replace(/\{count, plural,.*$/s, "{count}"), { count: report.image_count || 0 }));

  const box = { x: 112, y: 74, w: 80, h: 46 };
  const lines = cityStreets();
  const inside = lat <= map.north && lat >= map.south && lng >= map.west && lng <= map.east;
  if (lines && inside) {
    const [cx, cy] = project(lat, lng);
    const unitsW = 110;
    const s = box.w / unitsW;
    const ox = cx - unitsW / 2;
    const oy = cy - box.h / s / 2;
    doc.setFillColor(246, 249, 253);
    doc.roundedRect(box.x, box.y, box.w, box.h, 3, 3, "F");
    doc.saveGraphicsState();
    doc.roundedRect(box.x, box.y, box.w, box.h, 3, 3, null);
    doc.clip();
    doc.discardPath();
    const draw = (set_, width, rgb) => {
      doc.setDrawColor(...rgb);
      doc.setLineWidth(width);
      for (const polyline of set_) {
        const pts = polyline.filter((p) => p.length === 2 && p.every(Number.isFinite));
        if (pts.length < 2) continue;
        if (pts.every(([x, yy]) => x < ox - 5 || x > ox + unitsW + 5 || yy < oy - 5 || yy > oy + box.h / s + 5)) continue;
        pts.forEach(([x, yy], i) => {
          const X = box.x + (x - ox) * s;
          const Y = box.y + (yy - oy) * s;
          if (i === 0) doc.moveTo(X, Y);
          else doc.lineTo(X, Y);
        });
        doc.stroke();
      }
    };
    draw(lines.minor, 0.25, color.rule);
    draw(lines.major, 0.7, [176, 186, 200]);
    doc.restoreGraphicsState();
    // The gold pin at the reported spot.
    const pinX = box.x + box.w / 2;
    const pinY = box.y + box.h / 2;
    doc.setFillColor(...color.gold);
    doc.setDrawColor(...color.ink);
    doc.setLineWidth(0.35);
    doc.circle(pinX, pinY - 6, 3.4, "FD");
    doc.triangle(pinX - 2.9, pinY - 4.4, pinX + 2.9, pinY - 4.4, pinX, pinY, "F");
    doc.setFillColor(...color.ink);
    doc.circle(pinX, pinY - 6, 1.2, "F");
  }

  // The round stamp, next to the number.
  stamp(doc, { x: 168, y: 47, r: 17 }, {
    word: m.sent.stamp.toUpperCase(),
    city: cityName.toUpperCase(),
    id: report.public_id,
    day: dayText,
  });

  // The citizen's words on ruled lines.
  y = Math.max(y, box.y + box.h) + 12;
  set("Sofia", "bold", 12, color.ink);
  text(m.receipt.description, L, y);
  y += 8;
  set("Sofia", "normal", 11.5, color.ink);
  const lineGap = 6.6;
  const body = doc.splitTextToSize(clean(report.description), R - L);
  for (const line of body) {
    if (y > 232) {
      footer();
      doc.addPage();
      header();
      y = 44;
      set("Sofia", "normal", 11.5, color.ink);
    }
    text(line, L, y);
    doc.setDrawColor(...color.rule);
    doc.setLineWidth(0.25);
    doc.line(L, y + 1.9, R, y + 1.9);
    y += lineGap;
  }

  // Perforation, then the stub: how to follow the report.
  const stubTop = 240;
  if (y > stubTop - 6) {
    footer();
    doc.addPage();
    header();
  }
  doc.setDrawColor(...color.rule);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([1.6, 1.4], 0);
  doc.line(L, stubTop, R, stubTop);
  doc.setLineDashPattern([], 0);
  const qr = QRCode.create(trackURL, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const qrSize = 30;
  const cell = qrSize / size;
  const qx = R - qrSize;
  const qy = stubTop + 6;
  doc.setFillColor(...color.ink);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      if (qr.modules.get(row, col)) doc.rect(qx + col * cell, qy + row * cell, cell + 0.02, cell + 0.02, "F");
  set("SofiaNarrow", "normal", 14, color.blue);
  text(m.pdf.follow.toUpperCase(), L, stubTop + 12);
  set("Sofia", "normal", 10, color.ink);
  text(doc.splitTextToSize(fill(m.pdf.followBody, { url: trackURL }), qx - L - 8), L, stubTop + 19);
  set("Sofia", "normal", 8.5, color.pencil);
  text(doc.splitTextToSize(m.receipt.proofNote, qx - L - 8), L, stubTop + 31);

  footer();
  function footer() {
    set("Sofia", "normal", 7.5, color.pencil);
    text(doc.splitTextToSize(m.footer.disclaimer, 150), L, 281);
    text("in co-operation with CODON a part of Progon LLC.", L, 290);
  }
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    set("Sofia", "normal", 7.5, color.pencil);
    text(fill(m.pdf.page, { n: page, total }), R, 290, { align: "right" });
  }
  return Buffer.from(doc.output("arraybuffer"));
}

// Ring text over the top and under the bottom, the stamp word, number and date in the middle.
function stamp(doc, { x, y, r }, { word, city, id, day }) {
  doc.setDrawColor(...color.stamp);
  doc.setTextColor(...color.stamp);
  doc.setLineWidth(0.9);
  doc.circle(x, y, r, "S");
  doc.setLineWidth(0.4);
  doc.circle(x, y, r * 0.63, "S");
  const ring = (label, radius, startDeg, endDeg, size, flip) => {
    doc.setFont("SofiaNarrow", "normal");
    doc.setFontSize(size);
    const chars = [...label];
    const span = endDeg - startDeg;
    chars.forEach((ch, i) => {
      const t = chars.length === 1 ? 0.5 : i / (chars.length - 1);
      const deg = startDeg + span * t;
      const rad = (deg * Math.PI) / 180;
      const cx = x + radius * Math.cos(rad);
      const cy = y + radius * Math.sin(rad);
      // jsPDF angles are counter-clockwise; keep letters upright along the circle.
      const angle = flip ? -(deg - 90) : -(deg + 90);
      doc.text(ch, cx, cy, { angle, align: "center", baseline: "middle" });
    });
  };
  ring("KOSOVA.REPORT", r * 0.8, -160, -20, 7, false);
  ring(city, r * 0.8, 150, 30, 6.5, true);
  doc.setFillColor(...color.stamp);
  for (const side of [-1, 1]) doc.circle(x + side * r * 0.8, y, 0.7, "F");
  doc.setFont("SofiaNarrow", "normal");
  doc.setFontSize(12);
  doc.text(word, x, y - 1, { align: "center" });
  doc.setFont("Sofia", "bold");
  doc.setFontSize(6);
  doc.text(id, x, y + 3.2, { align: "center" });
  doc.setFont("Sofia", "normal");
  doc.text(day, x, y + 6.6, { align: "center" });
}
