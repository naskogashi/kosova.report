import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";
import webpush from "web-push";

const vapid = webpush.generateVAPIDKeys();
Object.assign(process.env, {
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  PUSH_SEAL_KEY: randomBytes(32).toString("base64"),
});
const push = await import("../src/lib/push.js");

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "B" + "A".repeat(86), auth: "a".repeat(22) },
  expirationTime: null,
};

test("subscriptions are sealed at rest and tampering is detected", () => {
  const sealed = push.seal(subscription);
  assert.ok(!sealed.toString("latin1").includes("fcm.googleapis.com"));
  assert.deepEqual(push.unseal(sealed), subscription);
  sealed[sealed.length - 1] ^= 1;
  assert.throws(() => push.unseal(sealed));
  assert.equal(push.endpointHash(subscription.endpoint).length, 64);
});

test("only real https subscriptions with proper keys are accepted", () => {
  assert.ok(push.validSubscription(subscription));
  assert.ok(!push.validSubscription({ ...subscription, endpoint: "http://fcm.googleapis.com/x" }));
  assert.ok(!push.validSubscription({ ...subscription, keys: { p256dh: "short", auth: "a".repeat(22) } }));
  assert.ok(!push.validSubscription(null));
});

test("notifications speak the device's language and link to the report without its key", () => {
  assert.deepEqual(push.personalPayload("opened", "PR-2026-000042", "sr"), {
    title: "kosova.report",
    body: "Prijavu PR-2026-000042 je otvorilo nadležno odeljenje.",
    path: "/sr/prati/PR-2026-000042",
    publicId: "PR-2026-000042",
    tag: "report-PR-2026-000042",
    lang: "sr",
  });
  assert.equal(push.personalPayload("Resolved", "PR-2026-000042", "xx").path, "/sq/gjurmo/PR-2026-000042");
  assert.equal(push.personalPayload("In Progress", "PR-2026-000042", "en").body, "Report PR-2026-000042 is being handled.");
});

function database(rows = {}) {
  const queries = [];
  return {
    queries,
    execute: async (sql, values = []) => {
      queries.push({ sql, values });
      for (const [prefix, result] of Object.entries(rows)) if (sql.startsWith(prefix)) return [result];
      return [{ affectedRows: 1 }];
    },
  };
}

test("each follower of a report gets one message, once-only events stay once", async () => {
  const db = database({
    "SELECT f.subscription_id": [
      { subscription_id: 1, locale: "sq", public_id: "PR-2026-000042" },
      { subscription_id: 2, locale: "en", public_id: "PR-2026-000042" },
    ],
  });
  assert.equal(await push.queueFollowerPush(db, 7, "opened", "opened"), 2);
  const inserts = db.queries.filter((q) => q.sql.startsWith("INSERT IGNORE INTO push_outbox"));
  assert.deepEqual(inserts.map((q) => [q.values[0], q.values[1], q.values[2]]), [
    [1, 7, "opened"],
    [2, 7, "opened"],
  ]);
  assert.equal(JSON.parse(inserts[1].values[3]).body, "The responsible department opened report PR-2026-000042.");
  // Only followers of a report that isn't anonymized.
  assert.match(db.queries[0].sql, /r\.anonymized_at IS NULL/);
  await push.queueFollowerPush(db, 7, "In Progress");
  await push.queueFollowerPush(db, 7, "In Progress");
  const keys = db.queries.filter((q) => q.sql.startsWith("INSERT IGNORE")).slice(2).map((q) => q.values[2]);
  assert.equal(new Set(keys).size, 2);
});

test("delivery sends what waits, forgets devices the push service dropped and retries the rest", async () => {
  const row = (id, subscriptionId) => ({
    id,
    subscription_id: subscriptionId,
    payload: { title: "kosova.report", body: "x" },
    topic: "r7",
    urgency: "normal",
    sealed: push.seal(subscription),
  });
  const db = database({ "SELECT o.id": [row(1, 1), row(2, 2), row(3, 3)] });
  const sent = [];
  const outcomes = [null, Object.assign(new Error("gone"), { statusCode: 410 }), Object.assign(new Error("busy"), { statusCode: 503 })];
  const result = await push.deliverPush(db, {
    send: async (to, payload, options) => {
      sent.push({ to, payload, options });
      const outcome = outcomes[sent.length - 1];
      if (outcome) throw outcome;
    },
  });
  assert.deepEqual(result, { sent: 1, gone: 1, failed: 1 });
  assert.deepEqual(sent[0].to, subscription);
  assert.equal(sent[0].payload, '{"title":"kosova.report","body":"x"}');
  assert.equal(sent[0].options.topic, "r7");
  const statements = db.queries.map((q) => [q.sql.split(" SET ")[0].split(" WHERE ")[0], q.values[0]]);
  assert.deepEqual(statements.slice(1), [
    ["UPDATE push_outbox", 1],
    ["UPDATE push_subscriptions", 1],
    ["DELETE FROM push_subscriptions", 2],
    ["UPDATE push_outbox", 3],
    ["UPDATE push_subscriptions", 3],
  ]);
});

test("a replaced subscription is accepted only with the old one's auth secret", async () => {
  const sealed = push.seal(subscription);
  const fresh = { ...subscription, endpoint: "https://fcm.googleapis.com/fcm/send/new" };
  const db = database({ "SELECT id,sealed": [{ id: 5, sealed }] });
  assert.equal(await push.renewSubscription(db, { ...subscription, keys: { ...subscription.keys, auth: "b".repeat(22) } }, fresh), false);
  assert.equal(await push.renewSubscription(db, subscription, fresh), true);
  const update = db.queries.at(-1);
  assert.equal(update.values[0], push.endpointHash(fresh.endpoint));
  assert.equal(update.values[2], 5);
});

async function subscribeRoute(report) {
  const followed = [];
  const module = new SourceTextModule(readFileSync("src/app/api/push/subscribe/route.js", "utf8"));
  const tracking = await import(
    `data:text/javascript;base64,${Buffer.from(readFileSync("src/lib/tracking.js", "utf8")).toString("base64")}`
  );
  const mocks = {
    "../../../../lib/db": {
      database: () => ({ execute: async (sql, values) => [sql.startsWith("SELECT id FROM reports") && report(values) ? [{ id: 7 }] : []] }),
      required: () => "https://kosova.report",
    },
    "../../../../lib/tracking": tracking,
    "../../../../lib/incidents": { clientAddress: () => "1.2.3.4", withinLimit: async () => true },
    "../../../../lib/push": {
      ...push,
      saveSubscription: async () => 9,
      followReport: async (db, subscriptionId, reportId) => followed.push([subscriptionId, reportId]),
    },
  };
  await module.link(async (name) => {
    const values = mocks[name];
    assert.ok(values, `Unexpected import ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { route: module.namespace, followed };
}
const key = "0f8fad5b-d9cb-469f-a165-70867728950e";
const subscribe = (body, origin = "https://kosova.report") =>
  new Request("https://kosova.report/api/push/subscribe", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, publicId: "PR-2026-000042", trackingKey: key, locale: "sr", ...body }),
  });

test("following a report needs its private key and the site's own origin", async () => {
  const app = await subscribeRoute(([publicId, trackingKey]) => publicId === "PR-2026-000042" && trackingKey === key);
  assert.equal((await app.route.POST(subscribe({}))).status, 200);
  assert.deepEqual(app.followed, [[9, 7]]);
  assert.equal((await app.route.POST(subscribe({ trackingKey: "1f8fad5b-d9cb-469f-a165-70867728950e" }))).status, 404);
  assert.equal((await app.route.POST(subscribe({ trackingKey: "not-a-key" }))).status, 400);
  assert.equal((await app.route.POST(subscribe({}, "https://evil.example"))).status, 403);
  assert.equal(app.followed.length, 1);
});
