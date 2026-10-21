import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import webpush from "web-push";

// Personal push notifications: a citizen's own device hears about their own report, at once and
// without staff approval. Subscriptions are sealed with a key that lives only in the
// environment; the database holds a hash of the endpoint and the sealed blob. Messages wait in
// push_outbox, written in the same transaction as the change they announce, and are sent after
// commit (and retried by the retention job). This file imports no app modules, so
// scripts/retention.mjs can use it too. Without VAPID keys and PUSH_SEAL_KEY it stays off.
export const pushConfigured = (env = process.env) =>
  Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.PUSH_SEAL_KEY);

function sealKey() {
  const key = Buffer.from(process.env.PUSH_SEAL_KEY || "", "base64");
  if (key.length !== 32) throw new Error("PUSH_SEAL_KEY must be 32 random bytes in base64");
  return key;
}
export function seal(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}
export function unseal(sealed) {
  const data = Buffer.from(sealed);
  const decipher = createDecipheriv("aes-256-gcm", sealKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
}
export const endpointHash = (endpoint) => createHash("sha256").update(endpoint).digest("hex");

const base64url = (value, min, max) => typeof value === "string" && new RegExp(`^[A-Za-z0-9_-]{${min},${max}}={0,2}$`).test(value);
export function validSubscription(subscription) {
  try {
    const url = new URL(subscription?.endpoint);
    return (
      url.protocol === "https:" &&
      subscription.endpoint.length <= 1000 &&
      base64url(subscription.keys?.p256dh, 80, 100) &&
      base64url(subscription.keys?.auth, 16, 30)
    );
  } catch {
    return false;
  }
}
const stored = ({ endpoint, keys }) => ({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });

export async function saveSubscription(db, subscription, locale) {
  const hash = endpointHash(subscription.endpoint);
  await db.execute(
    "INSERT INTO push_subscriptions (endpoint_hash,sealed,locale) VALUES (?,?,?) ON DUPLICATE KEY UPDATE sealed=VALUES(sealed),locale=VALUES(locale),failures=0",
    [hash, seal(stored(subscription)), locale],
  );
  const [rows] = await db.execute("SELECT id FROM push_subscriptions WHERE endpoint_hash=?", [hash]);
  return rows[0].id;
}

export async function followReport(db, subscriptionId, reportId) {
  await db.execute("INSERT IGNORE INTO push_report_follows (subscription_id,report_id) VALUES (?,?)", [subscriptionId, reportId]);
}

// The browser replaced a subscription. Knowing the old endpoint and its auth secret proves it's the same device.
export async function renewSubscription(db, old, subscription) {
  const [rows] = await db.execute("SELECT id,sealed FROM push_subscriptions WHERE endpoint_hash=?", [endpointHash(old?.endpoint || "")]);
  if (!rows.length || unseal(rows[0].sealed).keys.auth !== old?.keys?.auth) return false;
  await db.execute("UPDATE push_subscriptions SET endpoint_hash=?,sealed=?,failures=0 WHERE id=?", [
    endpointHash(subscription.endpoint),
    seal(stored(subscription)),
    rows[0].id,
  ]);
  return true;
}

export async function removeSubscription(db, endpoint) {
  await db.execute("DELETE FROM push_subscriptions WHERE endpoint_hash=?", [endpointHash(endpoint || "")]);
}

const TEXT = {
  sq: {
    opened: "Raporti {id} u hap nga departamenti përgjegjës.",
    "In Progress": "Raporti {id} po trajtohet.",
    Resolved: "Raporti {id} u shënua i zgjidhur. A është rregulluar vërtet?",
    Pending: "Raporti {id} u rihap dhe është sërish në pritje.",
    grouped: "Raporti {id} u bashkua me raporte të tjera për të njëjtin problem.",
    noResponse: "Raporti {id} nuk ka marrë përgjigje për 14 ditë. Shikoni ecurinë.",
  },
  sr: {
    opened: "Prijavu {id} je otvorilo nadležno odeljenje.",
    "In Progress": "Prijava {id} je u obradi.",
    Resolved: "Prijava {id} je označena kao rešena. Da li je zaista rešeno?",
    Pending: "Prijava {id} je ponovo otvorena i čeka obradu.",
    grouped: "Prijava {id} je spojena sa drugim prijavama istog problema.",
    noResponse: "Na prijavu {id} nema odgovora već 14 dana. Pogledajte status.",
  },
  en: {
    opened: "The responsible department opened report {id}.",
    "In Progress": "Report {id} is being handled.",
    Resolved: "Report {id} was marked as resolved. Is it really fixed?",
    Pending: "Report {id} was reopened and is waiting again.",
    grouped: "Report {id} was grouped with other reports of the same problem.",
    noResponse: "Report {id} has had no response for 14 days. Check its progress.",
  },
};
const TRACK = { sq: "gjurmo", sr: "prati", en: "track" };

// What the lock screen shows. The tracking key never travels in a notification.
export function personalPayload(event, publicId, locale) {
  const language = TEXT[locale] ? locale : "sq";
  return {
    title: "kosova.report",
    body: TEXT[language][event].replace("{id}", publicId),
    path: `/${language}/${TRACK[language]}/${publicId}`,
    publicId,
    tag: `report-${publicId}`,
    lang: language,
  };
}

// event: opened | In Progress | Resolved | Pending | grouped | noResponse. once: a key that
// makes the event happen only once per device (for example "opened"); otherwise every call is new.
export async function queueFollowerPush(db, reportId, event, once) {
  const [rows] = await db.execute(
    "SELECT f.subscription_id,s.locale,r.public_id FROM push_report_follows f JOIN push_subscriptions s ON s.id=f.subscription_id JOIN reports r ON r.id=f.report_id WHERE f.report_id=? AND r.anonymized_at IS NULL",
    [reportId],
  );
  const eventKey = once || `${event}:${randomBytes(9).toString("base64url")}`;
  for (const row of rows)
    await db.execute(
      "INSERT IGNORE INTO push_outbox (subscription_id,report_id,event_key,payload,topic,urgency) VALUES (?,?,?,?,?,'normal')",
      [row.subscription_id, reportId, eventKey, JSON.stringify(personalPayload(event, row.public_id, row.locale)), `r${reportId}`],
    );
  return rows.length;
}

// Followed reports still Pending 14 days after they were sent, never opened by the department.
export async function queueNoResponse(db) {
  const [rows] = await db.execute(
    "SELECT DISTINCT r.id FROM push_report_follows f JOIN reports r ON r.id=f.report_id WHERE r.status='Pending' AND r.first_opened_at IS NULL AND r.anonymized_at IS NULL AND r.created_at <= UTC_TIMESTAMP() - INTERVAL 14 DAY AND NOT EXISTS (SELECT 1 FROM push_outbox o WHERE o.report_id=r.id AND o.event_key='no-response') LIMIT 200",
  );
  for (const { id } of rows) await queueFollowerPush(db, id, "noResponse", "no-response");
  return rows.length;
}

// Sends what's waiting. A subscription the push service no longer knows is deleted.
export async function deliverPush(db, { send = (...args) => webpush.sendNotification(...args), limit = 100 } = {}) {
  const result = { sent: 0, gone: 0, failed: 0 };
  if (!pushConfigured()) return result;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@kosova.report",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  const [rows] = await db.execute(
    `SELECT o.id,o.subscription_id,o.payload,o.topic,o.urgency,s.sealed FROM push_outbox o JOIN push_subscriptions s ON s.id=o.subscription_id WHERE o.sent_at IS NULL AND o.attempts < 5 ORDER BY o.id LIMIT ${Number(limit) | 0}`,
  );
  for (const row of rows) {
    const payload = typeof row.payload === "string" ? row.payload : JSON.stringify(row.payload);
    try {
      await send(unseal(row.sealed), payload, { TTL: 7 * 24 * 3600, urgency: row.urgency, topic: row.topic || undefined });
      await db.execute("UPDATE push_outbox SET sent_at=UTC_TIMESTAMP(),attempts=attempts+1 WHERE id=?", [row.id]);
      await db.execute("UPDATE push_subscriptions SET last_sent_at=UTC_TIMESTAMP(),failures=0 WHERE id=?", [row.subscription_id]);
      result.sent++;
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) {
        await db.execute("DELETE FROM push_subscriptions WHERE id=?", [row.subscription_id]);
        result.gone++;
      } else {
        await db.execute("UPDATE push_outbox SET attempts=attempts+1 WHERE id=?", [row.id]);
        await db.execute("UPDATE push_subscriptions SET failures=LEAST(failures+1,255) WHERE id=?", [row.subscription_id]);
        result.failed++;
      }
    }
  }
  return result;
}
