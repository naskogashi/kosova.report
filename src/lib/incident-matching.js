// Finding reports of the same problem. Pure functions, shared by the server and the report flow.
//
// Two reports are "possibly the same" when they are close, in the same (or a likely
// mislabelled) category, and the earlier one is still open. Being close is never enough
// on its own: two potholes 20 m apart are two problems. So nothing here merges anything.
// The reporter decides in the report flow, and staff confirm or reject suggestions.

// How far apart two reports of one problem usually are. A pothole is a point; a rubbish
// dump or a broken street light run spreads out; a school or clinic is one building.
export const MATCH_RADIUS_M = {
  infrastructure: 60,
  environment: 100,
  public_services: 80,
  administration: 40,
  health: 40,
  education: 40,
  safety: 60,
};
const DEFAULT_RADIUS_M = 60;
// People pick the wrong category. A different category only counts when it is almost on top.
export const CROSS_CATEGORY_RADIUS_M = 30;
// A poor GPS fix widens the search, but never past this.
export const MAX_RADIUS_M = 150;
// The server refuses to attach a report to an incident further away than this,
// whatever the browser sent.
export const ATTACH_MAX_M = 250;
// A resolved incident is still shown for this long, so people can see it was just fixed.
export const RESOLVED_GRACE_DAYS = 14;
// At or above this score, a new incident is put in front of staff as a possible duplicate.
export const SUGGEST_SCORE = 0.45;
export const MAX_CANDIDATES = 5;
// Approximate pins for incidents that aren't public yet: snapped to a grid of about 55 x 40 m.
const GRID = 0.0005;

const rad = Math.PI / 180;
export function distanceM([lat1, lng1], [lat2, lng2]) {
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function searchRadius(category, accuracy) {
  const base = MATCH_RADIUS_M[category] || DEFAULT_RADIUS_M;
  const fix = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0;
  return Math.round(Math.min(MAX_RADIUS_M, Math.max(base, fix)));
}

// A box around a point, for the indexed SQL pre-filter. Exact distance is checked afterwards.
export function boundingBox([lat, lng], radiusM) {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.max(0.01, Math.cos(lat * rad)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export const approximate = ([lat, lng]) => [
  Number((Math.round(lat / GRID) * GRID).toFixed(4)),
  Number((Math.round(lng / GRID) * GRID).toFixed(4)),
];

// Distances shown to the public are rounded to 25 m, so the exact spot can't be worked out.
export const roundedDistance = (meters) => Math.max(25, Math.ceil(meters / 25) * 25);

// 0..1. Closeness matters most; then category, recency and how many people already reported it.
export function scoreCandidate({ distance, radius, sameCategory, ageDays, reportCount = 1, resolved = false }) {
  if (distance > radius) return 0;
  const closeness = 1 - (distance / radius) ** 2;
  const category = sameCategory ? 1 : 0.55;
  const recency = ageDays <= 30 ? 1 : Math.max(0.6, 1 - ((ageDays - 30) / 365) * 0.4);
  const crowd = Math.min(0.1, 0.03 * Math.log2(Math.max(1, reportCount)));
  const state = resolved ? 0.5 : 1;
  return Math.round(Math.min(1, (closeness * category * recency + crowd) * state) * 1000) / 1000;
}

// rows: incidents near the point, as read from the database (lat, lng, category, status,
// last_reported_at, resolved_at, report_count). Returns the likely matches, best first.
export function rankCandidates(point, category, rows, { accuracy, now = Date.now(), limit = MAX_CANDIDATES } = {}) {
  const radius = searchRadius(category, accuracy);
  const crossRadius = Math.min(radius, CROSS_CATEGORY_RADIUS_M + (Number.isFinite(accuracy) ? Math.min(accuracy, 60) / 3 : 0));
  const day = 86400000;
  return rows
    .map((row) => {
      const resolved = row.status === "Resolved";
      if (resolved && (!row.resolved_at || now - new Date(row.resolved_at).getTime() > RESOLVED_GRACE_DAYS * day))
        return null;
      const sameCategory = row.category === category;
      const distance = distanceM(point, [Number(row.lat), Number(row.lng)]);
      const score = scoreCandidate({
        distance,
        radius: sameCategory ? radius : crossRadius,
        sameCategory,
        ageDays: Math.max(0, (now - new Date(row.last_reported_at).getTime()) / day),
        reportCount: Number(row.report_count) || 1,
        resolved,
      });
      return score > 0 ? { ...row, distance: Math.round(distance), score, sameCategory, joinable: !resolved } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.distance - b.distance)
    .slice(0, limit);
}

export const validRef = (value) => /^[0-9a-f]{10}$/.test(value || "");
