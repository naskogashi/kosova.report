import { database } from "./db";

// News posts: updates, articles and reports from the team. Each post has its own
// title, summary and body per language; an empty title means "use Albanian".
export const newsKinds = ["update", "article", "report"];
export const newsLocales = ["sq", "sr", "en"];
const columns =
  "id,slug,kind,status,title_sq,title_sr,title_en,summary_sq,summary_sr,summary_en,body_sq,body_sr,body_en,cover_key,cover_mime,cover_alt_sq,cover_alt_sr,cover_alt_en,published_at,updated_at";

// The text a reader sees in `locale`, and which language it actually is.
export function localize(post, locale) {
  const lang = post[`title_${locale}`]?.trim() ? locale : "sq";
  return {
    id: post.id,
    slug: post.slug,
    kind: post.kind,
    lang,
    title: post[`title_${lang}`],
    summary: post[`summary_${lang}`],
    body: post[`body_${lang}`] || "",
    coverAlt: post[`cover_alt_${lang}`] || "",
    hasCover: Boolean(post.cover_key),
    publishedAt: post.published_at ? new Date(post.published_at).toISOString() : null,
    updatedAt: post.updated_at ? new Date(post.updated_at).toISOString() : null,
  };
}

// Public reads never throw: before migration 006 runs, or when MySQL is down,
// the news pages show their empty state instead of an error.
export async function publishedNews({ limit = 20, offset = 0 } = {}) {
  try {
    const [rows] = await database().query(
      `SELECT ${columns} FROM news_posts WHERE status='published' AND published_at<=UTC_TIMESTAMP() ORDER BY published_at DESC LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)],
    );
    return rows;
  } catch {
    return [];
  }
}

export async function publishedPost(slug) {
  if (!slugValid(slug)) return null;
  try {
    const [rows] = await database().execute(
      `SELECT ${columns} FROM news_posts WHERE slug=? AND status='published' AND published_at<=UTC_TIMESTAMP() LIMIT 1`,
      [slug],
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// The editor works in Kosovo time; the database stores UTC.
const ZONE = "Europe/Belgrade";
function zoneOffsetMs(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUTC - date.getTime();
}
// "2026-10-19T14:30" in Kosovo time → Date.
export function fromKosovoTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  const guess = Date.UTC(match[1], match[2] - 1, match[3], match[4], match[5]);
  return new Date(guess - zoneOffsetMs(new Date(guess)));
}
// Date → "2026-10-19T14:30" in Kosovo time, for <input type="datetime-local">.
export function toKosovoTime(date) {
  if (!date) return "";
  const local = new Date(new Date(date).getTime() + zoneOffsetMs(new Date(date)));
  return local.toISOString().slice(0, 16);
}

export const slugValid = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value || "") && value.length <= 120;

// Albanian and Serbian letters become plain Latin so slugs stay readable in any URL.
export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replaceAll("ë", "e")
    .replaceAll("ç", "c")
    .replaceAll("đ", "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function imageType(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return ["image/jpeg", "jpg"];
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return ["image/png", "png"];
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP")
    return ["image/webp", "webp"];
  return null;
}

// Plain-text body format the editor understands:
//   blank line = new paragraph, "## " / "### " headings, "- " list items,
//   **bold**, and [text](https://link). Nothing else is interpreted, so no HTML
//   from the database ever reaches the page.
export function parseBody(body) {
  const blocks = [];
  for (const chunk of String(body || "").replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((line) => line.trim());
    if (!lines.length) continue;
    if (lines.every((line) => /^\s*-\s+/.test(line)))
      blocks.push({ type: "list", items: lines.map((line) => inline(line.replace(/^\s*-\s+/, ""))) });
    else if (/^###\s+/.test(lines[0])) blocks.push({ type: "h3", content: inline(lines.join(" ").replace(/^###\s+/, "")) });
    else if (/^##\s+/.test(lines[0])) blocks.push({ type: "h2", content: inline(lines.join(" ").replace(/^##\s+/, "")) });
    else blocks.push({ type: "p", content: inline(lines.join(" ")) });
  }
  return blocks;
}
function inline(text) {
  const parts = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    if (match[1]) parts.push({ type: "bold", value: match[1] });
    else parts.push({ type: "link", value: match[2], href: match[3] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
