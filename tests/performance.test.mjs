import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const performance = await import(
  `data:text/javascript;base64,${Buffer.from(readFileSync("src/lib/performance.js", "utf8")).toString("base64")}`
);
const now = new Date("2026-10-21T12:00:00Z");
const at = (daysAgo) => new Date(now - daysAgo * 86400000);
const report = (department, category, status, sentDaysAgo, { respondedAfter = null, resolvedAfter = null } = {}) => ({
  department_id: department,
  category,
  status,
  created_at: at(sentDaysAgo),
  responded_at: respondedAfter === null ? null : at(sentDaysAgo - respondedAfter),
  resolved_at: resolvedAfter === null ? null : at(sentDaysAgo - resolvedAfter),
});
const departments = [
  { id: 1, name: "Directorate of Public Services" },
  { id: 2, name: "Directorate of Environment" },
  { id: 3, name: "Directorate with no reports" },
];
const rows = [
  // Department 1: five reports, four answered, three resolved (two within 30 days).
  report(1, "infrastructure", "Resolved", 60, { respondedAfter: 0.5, resolvedAfter: 10 }),
  report(1, "infrastructure", "Resolved", 50, { respondedAfter: 2, resolvedAfter: 20 }),
  report(1, "infrastructure", "Resolved", 90, { respondedAfter: 5, resolvedAfter: 45 }),
  report(1, "safety", "In Progress", 20, { respondedAfter: 10 }),
  report(1, "infrastructure", "Pending", 3),
  // Department 2: two reports, below the minimum for a score.
  report(2, "environment", "Pending", 40),
  report(2, "environment", "Resolved", 5, { respondedAfter: 40 / 24, resolvedAfter: 3 }),
];

test("overall numbers: volume, response and resolution rates, medians", () => {
  const { overall } = performance.summarize(rows, departments, now);
  assert.equal(overall.total, 7);
  assert.equal(overall.last30, 3);
  assert.deepEqual([overall.pending, overall.inProgress, overall.resolved], [2, 1, 4]);
  assert.equal(overall.responseRate, 71); // 5 of 7
  assert.equal(overall.resolutionRate, 57); // 4 of 7
  assert.equal(overall.medianResponseDays, 2); // 0.5, 1.7, 2, 5, 10
  assert.equal(overall.medianResolveDays, 15); // 3, 10, 20, 45
});

test("each agency is scored from its own reports, only from the minimum up, best first", () => {
  const { agencies } = performance.summarize(rows, departments, now);
  assert.deepEqual(agencies.map((a) => a.name), ["Directorate of Public Services", "Directorate of Environment"]);
  const [services, environment] = agencies;
  assert.equal(services.total, 5);
  assert.equal(services.responseRate, 80);
  assert.equal(services.resolutionRate, 60);
  // A third each: 80 responded, 60 resolved, 40 resolved within 30 days.
  assert.equal(services.score, 60);
  assert.equal(environment.total, 2);
  assert.equal(environment.score, null);
});

test("response times fall into buckets and months count received and resolved", () => {
  const data = performance.summarize(rows, departments, now);
  assert.deepEqual(data.buckets, { sameDay: 1, upTo3: 2, upTo7: 1, upTo30: 1, over30: 0, none: 2 });
  assert.equal(data.months.length, 12);
  assert.equal(data.months.at(-1).month, "2026-10");
  assert.equal(data.months.reduce((sum, m) => sum + m.received, 0), 7);
  assert.equal(data.months.find((m) => m.month === "2026-10").resolved, 1);
  assert.deepEqual(data.categories[0], { category: "infrastructure", total: 4, resolutionRate: 75 });
});

test("the scorecard CSV has one row per agency and escapes commas", () => {
  const data = { city: { name: "Prishtinë" }, ...performance.summarize(rows, [{ id: 1, name: "Services, roads" }], now) };
  const [header, line] = performance.agenciesCSV(data).trim().split("\n");
  assert.match(header, /^municipality,agency,reports,/);
  assert.equal(line, 'Prishtinë,"Services, roads",5,1,1,3,80,3.5,60,20,60');
});

test("no reports means no score and empty charts, not errors", () => {
  const data = performance.summarize([], departments, now);
  assert.equal(data.overall.total, 0);
  assert.equal(data.overall.responseRate, null);
  assert.equal(data.overall.medianResolveDays, null);
  assert.deepEqual(data.agencies, []);
});
