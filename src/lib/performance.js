// Institutional performance, as shown on the public dashboard, in the embed widget and in the
// CSV download. Everything is computed from the same rows, so the three never disagree. It uses
// only what stays after anonymization (department, category, status, dates), so resolved and
// anonymized reports keep counting. Nothing about the people who reported is involved.
//
// Definitions (also explained on the page):
//   responded       the department opened the report or its status changed
//   response rate   responded / reports
//   resolution rate resolved / reports
//   score           a third each: response rate, resolution rate, and the share of reports
//                   resolved within 30 days. Shown only from MIN_REPORTS reports up.
export const MIN_REPORTS = 5;
const DAY = 86400000;
export const RESPONSE_BUCKETS = ["sameDay", "upTo3", "upTo7", "upTo30", "over30", "none"];

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 10) / 10;
}
const days = (from, to) => (new Date(to) - new Date(from)) / DAY;

function measures(rows) {
  const responded = rows.filter((row) => row.responded_at);
  const resolved = rows.filter((row) => row.status === "Resolved");
  const resolvedTimes = resolved.filter((row) => row.resolved_at).map((row) => days(row.created_at, row.resolved_at));
  const within30 = resolvedTimes.filter((value) => value <= 30).length;
  const total = rows.length;
  const responseRate = percent(responded.length, total);
  const resolutionRate = percent(resolved.length, total);
  return {
    total,
    pending: rows.filter((row) => row.status === "Pending").length,
    inProgress: rows.filter((row) => row.status === "In Progress").length,
    resolved: resolved.length,
    responseRate,
    resolutionRate,
    medianResponseDays: median(responded.map((row) => days(row.created_at, row.responded_at))),
    medianResolveDays: median(resolvedTimes),
    score: total >= MIN_REPORTS ? Math.round((responseRate + resolutionRate + percent(within30, total)) / 3) : null,
  };
}

// rows: { department_id, category, status, created_at, resolved_at, responded_at }
export function summarize(rows, departments, now = new Date()) {
  const overall = measures(rows);
  const buckets = Object.fromEntries(RESPONSE_BUCKETS.map((key) => [key, 0]));
  for (const row of rows) {
    if (!row.responded_at) buckets.none++;
    else {
      const value = days(row.created_at, row.responded_at);
      buckets[value < 1 ? "sameDay" : value <= 3 ? "upTo3" : value <= 7 ? "upTo7" : value <= 30 ? "upTo30" : "over30"]++;
    }
  }
  // Last 12 calendar months (UTC), oldest first: reports received and reports resolved.
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ month: date.toISOString().slice(0, 7), received: 0, resolved: 0 });
  }
  const byMonth = new Map(months.map((item) => [item.month, item]));
  for (const row of rows) {
    const received = byMonth.get(new Date(row.created_at).toISOString().slice(0, 7));
    if (received) received.received++;
    if (row.resolved_at) {
      const resolved = byMonth.get(new Date(row.resolved_at).toISOString().slice(0, 7));
      if (resolved) resolved.resolved++;
    }
  }
  const categories = [...new Set(rows.map((row) => row.category))].map((category) => {
    const group = rows.filter((row) => row.category === category);
    return { category, total: group.length, resolutionRate: percent(group.filter((row) => row.status === "Resolved").length, group.length) };
  });
  categories.sort((a, b) => b.total - a.total);
  const agencies = departments
    .map((department) => ({ id: department.id, name: department.name, ...measures(rows.filter((row) => String(row.department_id) === String(department.id))) }))
    .filter((agency) => agency.total > 0)
    // Scored agencies first, best score first; the rest by number of reports.
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.total - a.total);
  const last30 = rows.filter((row) => now - new Date(row.created_at) <= 30 * DAY).length;
  return { overall: { ...overall, last30 }, buckets, months, categories, agencies };
}

export async function loadPerformance(db, cityCode) {
  const [cities] = await db.execute(
    "SELECT c.id,UPPER(c.code) AS code,c.name FROM cities c JOIN municipality_settings m ON m.city_id=c.id WHERE m.enabled=1 ORDER BY c.name",
  );
  const city = cities.find((item) => item.code === cityCode) || cities[0];
  if (!city) return { cities: [], city: null };
  const [[rows], [departments]] = await Promise.all([
    db.execute(
      "SELECT r.department_id,r.category,r.status,r.created_at,r.resolved_at,r.first_opened_at,(SELECT MIN(a.created_at) FROM report_audit_log a WHERE a.report_id=r.id AND a.new_status<>a.previous_status) AS first_change_at FROM reports r WHERE r.city_id=?",
      [city.id],
    ),
    db.execute("SELECT id,name FROM departments WHERE city_id=? ORDER BY name", [city.id]),
  ]);
  // The first sign of a response: the department opening the report or the first status change.
  const responded = rows.map(({ first_opened_at, first_change_at, ...row }) => {
    const times = [first_opened_at, first_change_at].filter(Boolean).map((value) => new Date(value));
    return { ...row, responded_at: times.length ? new Date(Math.min(...times)) : null };
  });
  return {
    cities: cities.map(({ code, name }) => ({ code, name })),
    city: { code: city.code, name: city.name },
    updatedAt: new Date().toISOString(),
    ...summarize(responded, departments),
  };
}

// One row per agency, for journalists and researchers.
export function agenciesCSV(data) {
  const cell = (value) => (value === null || value === undefined ? "" : /[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));
  const header = ["municipality", "agency", "reports", "pending", "in_progress", "resolved", "response_rate_pct", "median_days_to_response", "resolution_rate_pct", "median_days_to_resolve", "score"];
  const lines = data.agencies.map((agency) =>
    [data.city.name, agency.name, agency.total, agency.pending, agency.inProgress, agency.resolved, agency.responseRate, agency.medianResponseDays, agency.resolutionRate, agency.medianResolveDays, agency.score].map(cell).join(","),
  );
  return [header.join(","), ...lines].join("\n") + "\n";
}

// The dashboard, the widget and the CSV share one computation per municipality for 5 minutes.
const cache = new Map();
export async function cachedPerformance(db, cityCode) {
  const key = cityCode || "";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.data;
  const data = await loadPerformance(db, cityCode);
  cache.set(key, { at: Date.now(), data });
  return data;
}
