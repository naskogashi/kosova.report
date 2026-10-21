import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";

const source = (file) => `data:text/javascript;base64,${Buffer.from(readFileSync(file, "utf8")).toString("base64")}`;
const matching = await import(source("src/lib/incident-matching.js"));
const {
  ATTACH_MAX_M,
  SUGGEST_SCORE,
  approximate,
  distanceM,
  rankCandidates,
  roundedDistance,
  searchRadius,
} = matching;

// A point `meters` east of Prishtina's centre.
const origin = [42.6629, 21.1655];
const east = (meters) => [origin[0], origin[1] + meters / (111320 * Math.cos((origin[0] * Math.PI) / 180))];
const now = Date.parse("2026-10-20T10:00:00Z");
const day = 86400000;
const row = (overrides = {}) => {
  const [lat, lng] = overrides.at || east(10);
  return {
    id: 1,
    ref: "aaaaaaaaaa",
    category: "infrastructure",
    status: "Pending",
    lat,
    lng,
    report_count: 1,
    last_reported_at: new Date(now - 2 * day).toISOString(),
    resolved_at: null,
    ...overrides,
  };
};

test("distances are in metres", () => {
  assert.ok(Math.abs(distanceM(origin, east(100)) - 100) < 0.5);
  assert.ok(Math.abs(distanceM(origin, [origin[0] + 0.001, origin[1]]) - 111.2) < 0.5);
});

test("the same pothole reported twice is a strong match", () => {
  const [match] = rankCandidates(origin, "infrastructure", [row({ at: east(8) })], { now });
  assert.ok(match.score >= 0.9);
  assert.ok(match.score >= SUGGEST_SCORE);
  assert.equal(match.joinable, true);
});

test("a second pothole right next to the first is shown to the reporter but not pushed to staff", () => {
  // 50 m apart on the same street: could be the same, could be another hole. The reporter sees it
  // and decides; it scores below the staff suggestion line, so staff aren't asked to merge it.
  const [match] = rankCandidates(origin, "infrastructure", [row({ at: east(50) })], { now });
  assert.ok(match, "still offered to the reporter");
  assert.ok(match.score < SUGGEST_SCORE);
  assert.equal(rankCandidates(origin, "infrastructure", [row({ at: east(70) })], { now }).length, 0);
});

test("another category only counts when it is almost on the same spot", () => {
  const near = rankCandidates(origin, "infrastructure", [row({ category: "safety", at: east(12) })], { now });
  assert.equal(near.length, 1);
  assert.equal(near[0].sameCategory, false);
  const same = rankCandidates(origin, "infrastructure", [row({ at: east(12) })], { now });
  assert.ok(near[0].score < same[0].score);
  assert.equal(rankCandidates(origin, "infrastructure", [row({ category: "safety", at: east(40) })], { now }).length, 0);
});

test("spread-out problems search wider than a single building", () => {
  assert.ok(searchRadius("environment") > searchRadius("infrastructure"));
  assert.ok(searchRadius("education") < searchRadius("infrastructure"));
  assert.equal(rankCandidates(origin, "environment", [row({ category: "environment", at: east(90) })], { now }).length, 1);
  assert.equal(rankCandidates(origin, "education", [row({ category: "education", at: east(50) })], { now }).length, 0);
});

test("a poor GPS fix widens the search, but only up to the cap", () => {
  assert.equal(searchRadius("infrastructure", 120), 120);
  assert.equal(searchRadius("infrastructure", 900), 150);
  assert.equal(searchRadius("infrastructure", 5), 60);
  assert.equal(rankCandidates(origin, "infrastructure", [row({ at: east(100) })], { now, accuracy: 120 }).length, 1);
});

test("resolved issues show for two weeks, can't be joined, and rank lower", () => {
  const recent = row({ status: "Resolved", resolved_at: new Date(now - 3 * day).toISOString(), at: east(8) });
  const [shown] = rankCandidates(origin, "infrastructure", [recent], { now });
  assert.equal(shown.joinable, false);
  assert.ok(shown.score < 0.6);
  const old = { ...recent, resolved_at: new Date(now - 20 * day).toISOString() };
  assert.equal(rankCandidates(origin, "infrastructure", [old], { now }).length, 0);
});

test("old open issues still match, a little weaker", () => {
  const fresh = rankCandidates(origin, "infrastructure", [row({ at: east(20) })], { now })[0];
  const stale = rankCandidates(
    origin,
    "infrastructure",
    [row({ at: east(20), last_reported_at: new Date(now - 300 * day).toISOString() })],
    { now },
  )[0];
  assert.ok(stale.score < fresh.score);
  assert.ok(stale.score > 0.4);
});

test("best matches come first and at most five are returned", () => {
  const rows = Array.from({ length: 8 }, (_, i) => row({ id: i, ref: String(i).repeat(10), at: east(5 + i * 6) }));
  const ranked = rankCandidates(origin, "infrastructure", rows.reverse(), { now });
  assert.equal(ranked.length, 5);
  assert.deepEqual(
    ranked.map((item) => item.id),
    [0, 1, 2, 3, 4],
  );
});

test("unpublished places are blurred and public distances rounded", () => {
  const [lat, lng] = approximate([42.66291234, 21.16557891]);
  assert.ok(Math.abs(lat - 42.66291234) < 0.00026);
  assert.ok(Math.abs(lng - 21.16557891) < 0.00026);
  for (const value of [lat, lng]) assert.ok(Math.abs(value / 0.0005 - Math.round(value / 0.0005)) < 1e-6);
  assert.equal(roundedDistance(3), 25);
  assert.equal(roundedDistance(26), 50);
});

// lib/incidents.js against a scripted database.
async function incidents(handler) {
  const queries = [];
  const connection = {
    execute: async (sql, values = []) => {
      queries.push({ sql, values });
      return (await handler(sql, values)) ?? [{ affectedRows: 1, insertId: 0 }];
    },
  };
  const queued = [];
  const mocks = {
    "node:crypto": await import("node:crypto"),
    "./report-notifications": {
      queueStatusEmails: async (conn, reportId, eventKey, audiences) => queued.push({ reportId, eventKey, audiences }),
    },
    "./incident-matching": matching,
    "./report-status": {
      setReportStatus: (conn, reportId, status) =>
        conn.execute("UPDATE reports SET status=? WHERE id=?", [status, reportId]),
    },
  };
  const module = new SourceTextModule(readFileSync("src/lib/incidents.js", "utf8"));
  await module.link(async (name) => {
    const values = mocks[name];
    assert.ok(values, `Unexpected import ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { lib: module.namespace, connection, queries, queued };
}
const nearbyRow = (overrides = {}) => ({
  ...row({ at: overrides.at || east(10) }),
  id: 9,
  ref: "bbbbbbbbbb",
  visibility: "listed",
  upvote_count: 0,
  comment_count: 0,
  public_summary: "",
  first_reported_at: new Date(now - 5 * day).toISOString(),
  last_reported_at: new Date().toISOString(),
  ...overrides,
});

test("a report joins the issue the reporter chose when it is close and open", async () => {
  const app = await incidents((sql) => {
    if (sql.startsWith("SELECT id,ref,status,lat,lng,report_count FROM incidents WHERE ref=?"))
      return [[{ id: 4, ref: "cccccccccc", status: "In Progress", lat: east(30)[0], lng: east(30)[1], report_count: 2 }]];
  });
  const result = await app.lib.attachReport(app.connection, {
    reportId: 70,
    cityId: 1,
    category: "infrastructure",
    point: origin,
    chosenRef: "cccccccccc",
  });
  assert.deepEqual(result, { id: 4, ref: "cccccccccc", joined: true, report_count: 3, status: "In Progress" });
  const update = app.queries.find((q) => q.sql.startsWith("UPDATE reports SET incident_id=?,incident_link='reporter'"));
  assert.deepEqual(update.values, [4, "In Progress", 70]);
  assert.ok(!app.queries.some((q) => q.sql.startsWith("INSERT INTO incidents")));
});

test("a chosen issue that is too far away or resolved is not trusted", async () => {
  for (const chosen of [
    { status: "Pending", at: east(ATTACH_MAX_M + 40) },
    { status: "Resolved", at: east(10) },
  ]) {
    const app = await incidents((sql) => {
      if (sql.startsWith("SELECT id,ref,status,lat,lng,report_count FROM incidents WHERE ref=?"))
        return [[{ id: 4, ref: "cccccccccc", status: chosen.status, lat: chosen.at[0], lng: chosen.at[1], report_count: 1 }]];
      if (sql.startsWith("INSERT INTO incidents")) return [{ insertId: 12 }];
      if (sql.startsWith("SELECT ref FROM incidents WHERE id=?")) return [[{ ref: "dddddddddd" }]];
      if (sql.startsWith("SELECT id,ref,category,status,visibility")) return [[]];
    });
    const result = await app.lib.attachReport(app.connection, {
      reportId: 70,
      cityId: 1,
      category: "infrastructure",
      point: origin,
      chosenRef: "cccccccccc",
    });
    assert.equal(result.joined, false);
    assert.equal(result.ref, "dddddddddd");
  }
});

test("a new issue puts close matches in front of staff and notes the ones the reporter ruled out", async () => {
  const app = await incidents((sql) => {
    if (sql.startsWith("INSERT INTO incidents")) return [{ insertId: 12 }];
    if (sql.startsWith("SELECT ref FROM incidents WHERE id=?")) return [[{ ref: "dddddddddd" }]];
    if (sql.startsWith("SELECT id,ref,category,status,visibility"))
      return [
        [
          nearbyRow({ id: 9, ref: "bbbbbbbbbb", at: east(6) }),
          nearbyRow({ id: 10, ref: "eeeeeeeeee", at: east(8) }),
          nearbyRow({ id: 11, ref: "ffffffffff", at: east(55) }),
        ],
      ];
  });
  const result = await app.lib.attachReport(app.connection, {
    reportId: 70,
    cityId: 1,
    category: "infrastructure",
    point: origin,
    declinedRefs: ["eeeeeeeeee", "ffffffffff"],
  });
  assert.equal(result.joined, false);
  const nearby = app.queries.find((q) => q.sql.startsWith("SELECT id,ref,category,status,visibility"));
  assert.ok(!nearby.sql.includes("visibility<>'hidden'"), "staff suggestions also consider hidden issues");
  const suggestions = app.queries.filter((q) => q.sql.startsWith("INSERT IGNORE INTO incident_duplicate_candidates"));
  assert.deepEqual(
    suggestions.map((q) => [q.values[1], q.values[4]]),
    [
      [9, "system"],
      [10, "reporter_declined"],
    ],
  );
});

test("a status change reaches every report of the issue, each reporter by their own email", async () => {
  let audit = 100;
  const app = await incidents((sql) => {
    if (sql.startsWith("SELECT incident_id,department_id,public_id FROM reports"))
      return [[{ incident_id: 4, department_id: 2, public_id: "PR-2026-000010" }]];
    if (sql.startsWith("SELECT id,status,department_id FROM reports WHERE incident_id=?"))
      return [
        [
          { id: 11, status: "Pending", department_id: 2 },
          { id: 12, status: "Pending", department_id: 3 },
        ],
      ];
    if (sql.startsWith("INSERT INTO report_audit_log")) return [{ insertId: ++audit }];
  });
  const events = await app.lib.syncIncidentStatus(app.connection, 10, "Resolved", "dept@example.org");
  assert.deepEqual(events, ["audit:101", "audit:102"]);
  assert.deepEqual(
    app.queued.map((q) => [q.reportId, q.audiences]),
    [
      [11, ["reporter"]],
      [12, ["department", "reporter"]],
    ],
  );
  const except = app.queries.find((q) => q.sql.startsWith("SELECT id,status,department_id FROM reports"));
  assert.deepEqual(except.values, [4, 10, "Resolved"]);
  assert.match(except.sql, /anonymized_at IS NULL/);
});

test("reports without an issue (old rows) are left alone", async () => {
  const app = await incidents((sql) => {
    if (sql.startsWith("SELECT incident_id")) return [[{ incident_id: null }]];
  });
  assert.deepEqual(await app.lib.syncIncidentStatus(app.connection, 10, "Resolved", "x"), []);
  assert.equal(app.queries.length, 1);
});

test("merging keeps the furthest open stage, never resolves an open problem, and refuses odd pairs", async () => {
  const run = async (sourceStatus, targetStatus, sourceCity = 1) => {
    const app = await incidents((sql) => {
      if (sql.startsWith("SELECT id,ref,city_id,status,merged_into FROM incidents"))
        return [
          [
            { id: 1, ref: "1111111111", city_id: sourceCity, status: sourceStatus, merged_into: null },
            { id: 2, ref: "2222222222", city_id: 1, status: targetStatus, merged_into: null },
          ],
        ];
      if (sql.startsWith("SELECT id,status,department_id FROM reports")) return [[]];
    });
    await app.lib.mergeIncidents(app.connection, { sourceId: 1, targetId: 2, actor: "owner@x", actorId: 5 });
    return app.queries.find((q) => q.sql.startsWith("UPDATE incidents SET status=?")).values[0];
  };
  assert.equal(await run("In Progress", "Pending"), "In Progress");
  assert.equal(await run("Pending", "Resolved"), "Pending");
  assert.equal(await run("Resolved", "Resolved"), "Resolved");
  await assert.rejects(run("Pending", "Pending", 7), /city/);
  const app = await incidents(() => {});
  await assert.rejects(app.lib.mergeIncidents(app.connection, { sourceId: 3, targetId: 3, actor: "x" }), /same/);
});

test("separating a report remembers the pair as different problems", async () => {
  const app = await incidents((sql) => {
    if (sql.startsWith("SELECT r.id,r.public_id"))
      return [
        [
          {
            id: 70,
            public_id: "PR-2026-000070",
            city_id: 1,
            category: "infrastructure",
            lat: east(40)[0],
            lng: east(40)[1],
            status: "Pending",
            incident_id: 4,
            ref: "cccccccccc",
            visibility: "public",
            report_count: 3,
            incident_lat: origin[0],
            incident_lng: origin[1],
          },
        ],
      ];
    if (sql.startsWith("INSERT INTO incidents")) return [{ insertId: 13 }];
    if (sql.startsWith("SELECT ref FROM incidents WHERE id=?")) return [[{ ref: "gggggggggg" }]];
  });
  const created = await app.lib.splitReport(app.connection, { reportId: 70, actor: "owner@x", actorId: 5 });
  assert.equal(created.ref, "gggggggggg");
  const insert = app.queries.find((q) => q.sql.startsWith("INSERT INTO incidents"));
  assert.equal(insert.values[6], "listed", "a public summary doesn't follow the separated report");
  const distinct = app.queries.find((q) => q.sql.includes("'distinct'"));
  assert.deepEqual(distinct.values.slice(0, 3), [13, 4, 40]);
});

test("the public view never exposes an exact pin, text or photos before staff publish", async () => {
  const listed = {
    ...nearbyRow({ at: [42.66291234, 21.16557891] }),
    public_summary: "Pothole by the school",
    visibility: "listed",
  };
  const app = await incidents(() => {});
  const view = app.lib.publicSummary(listed, origin);
  assert.equal(view.exact, false);
  assert.equal(view.summary, "");
  assert.notDeepEqual(view.point, [listed.lat, listed.lng]);
  assert.equal(view.distance_m % 25, 0);
  const published = app.lib.publicSummary({ ...listed, visibility: "public" });
  assert.equal(published.exact, true);
  assert.equal(published.summary, "Pothole by the school");
});

test("voter ids are hashed and malformed cookies are ignored", async () => {
  const app = await incidents(() => {});
  const cookie = app.lib.newVoterCookie();
  assert.match(app.lib.voterHash(cookie), /^[0-9a-f]{64}$/);
  assert.notEqual(app.lib.voterHash(cookie), cookie);
  assert.equal(app.lib.voterHash("short"), null);
  assert.equal(app.lib.voterHash("x'; DROP TABLE"), null);
});
