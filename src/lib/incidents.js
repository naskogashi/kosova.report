import { createHash, randomBytes } from "node:crypto";
import { queueStatusEmails } from "./report-notifications";
import { setReportStatus } from "./report-status";
import { queueFollowerPush } from "./push";
import {
  ATTACH_MAX_M,
  MAX_RADIUS_M,
  SUGGEST_SCORE,
  approximate,
  boundingBox,
  distanceM,
  rankCandidates,
  roundedDistance,
} from "./incident-matching";

// Incidents group the reports of one problem. See sql/007_incidents.sql for the model
// and incident-matching.js for how possible duplicates are found.

const statusRank = { Pending: 0, "In Progress": 1, Resolved: 2 };
export const newRef = () => randomBytes(5).toString("hex");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// Open incidents (and ones resolved in the last two weeks) around a point, best match first.
// publicOnly leaves out hidden incidents; staff suggestions consider every incident.
export async function findCandidates(db, { cityId, category, point, accuracy, publicOnly = true, excludeId = 0 }) {
  const box = boundingBox(point, MAX_RADIUS_M);
  const [rows] = await db.execute(
    `SELECT id,ref,category,status,visibility,lat,lng,report_count,upvote_count,comment_count,public_summary,first_reported_at,last_reported_at,resolved_at FROM incidents WHERE city_id=? AND merged_into IS NULL AND id<>? ${publicOnly ? "AND visibility<>'hidden'" : ""} AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND (status<>'Resolved' OR resolved_at>UTC_TIMESTAMP()-INTERVAL 14 DAY) LIMIT 200`,
    [cityId, excludeId, box.minLat, box.maxLat, box.minLng, box.maxLng],
  );
  return rankCandidates(point, category, rows, { accuracy });
}

// The public face of an incident in a list: no exact pin unless staff published it.
export function publicSummary(row, origin) {
  const published = row.visibility === "public";
  const point = [Number(row.lat), Number(row.lng)];
  return {
    ref: row.ref,
    category: row.category,
    status: row.status,
    point: published ? point : approximate(point),
    exact: published,
    distance_m: origin ? roundedDistance(distanceM(origin, point)) : undefined,
    report_count: Number(row.report_count),
    upvote_count: Number(row.upvote_count),
    comment_count: Number(row.comment_count),
    summary: published ? row.public_summary : "",
    first_reported_at: row.first_reported_at,
    last_reported_at: row.last_reported_at,
    resolved_at: row.resolved_at,
    joinable: row.status !== "Resolved",
  };
}

async function insertIncident(connection, values) {
  for (let attempt = 0; ; attempt++) {
    try {
      const [inserted] = await connection.execute(
        "INSERT INTO incidents (ref,city_id,category,lat,lng,status,visibility,report_count,seed_report_id,first_reported_at,last_reported_at) VALUES (?,?,?,?,?,?,?,1,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())",
        [newRef(), values.cityId, values.category, values.lat, values.lng, values.status, values.visibility, values.seedReportId],
      );
      const [rows] = await connection.execute("SELECT ref FROM incidents WHERE id=?", [inserted.insertId]);
      return { id: inserted.insertId, ref: rows[0].ref };
    } catch (error) {
      if (error.code !== "ER_DUP_ENTRY" || attempt >= 2) throw error;
    }
  }
}

// Puts a just-inserted report into an incident, inside the submission transaction.
// chosenRef: the incident the reporter said is the same problem. It is checked again here:
// same municipality, still open, not hidden, and within ATTACH_MAX_M of the new pin.
// declinedRefs: incidents the reporter was shown and said are different.
export async function attachReport(connection, { reportId, cityId, category, point, accuracy, chosenRef, declinedRefs = [] }) {
  if (chosenRef) {
    const [rows] = await connection.execute(
      "SELECT id,ref,status,lat,lng,report_count FROM incidents WHERE ref=? AND city_id=? AND merged_into IS NULL AND visibility<>'hidden' LIMIT 1 FOR UPDATE",
      [chosenRef, cityId],
    );
    const chosen = rows[0];
    if (
      chosen &&
      chosen.status !== "Resolved" &&
      distanceM(point, [Number(chosen.lat), Number(chosen.lng)]) <= ATTACH_MAX_M
    ) {
      await connection.execute(
        "UPDATE incidents SET report_count=report_count+1,last_reported_at=UTC_TIMESTAMP() WHERE id=?",
        [chosen.id],
      );
      // The new report joins at the incident's stage, so its reporter isn't told "Pending"
      // about something already being fixed.
      await connection.execute(
        "UPDATE reports SET incident_id=?,incident_link='reporter',status=? WHERE id=?",
        [chosen.id, chosen.status, reportId],
      );
      return { id: chosen.id, ref: chosen.ref, joined: true, report_count: Number(chosen.report_count) + 1, status: chosen.status };
    }
  }
  const created = await insertIncident(connection, {
    cityId,
    category,
    lat: point[0],
    lng: point[1],
    status: "Pending",
    visibility: "listed",
    seedReportId: reportId,
  });
  await connection.execute("UPDATE reports SET incident_id=?,incident_link='new' WHERE id=?", [created.id, reportId]);
  // Possible duplicates go to staff, including the ones the reporter said were different:
  // staff see that note and usually agree, but a second pair of eyes is cheap.
  const candidates = await findCandidates(connection, {
    cityId,
    category,
    point,
    accuracy,
    publicOnly: false,
    excludeId: created.id,
  });
  for (const candidate of candidates) {
    const declined = declinedRefs.includes(candidate.ref);
    if (candidate.score < SUGGEST_SCORE && candidate.ref !== chosenRef) continue;
    await connection.execute(
      "INSERT IGNORE INTO incident_duplicate_candidates (incident_id,candidate_id,distance_m,score,source) VALUES (?,?,?,?,?)",
      [created.id, candidate.id, candidate.distance, candidate.score, declined ? "reporter_declined" : "system"],
    );
  }
  return { id: created.id, ref: created.ref, joined: false, report_count: 1, status: "Pending" };
}

// Gives every report of an incident the same status. Each reporter whose report changes
// gets their own status email; a department hears about it if it isn't the one acting.
// Returns the event keys to deliver after commit.
async function applyStatus(connection, incidentId, status, { actor, note, exceptReportId = 0, actingDepartmentId = 0 }) {
  await connection.execute(
    "UPDATE incidents SET status=?,resolved_at=CASE WHEN ?='Resolved' THEN COALESCE(resolved_at,UTC_TIMESTAMP()) ELSE NULL END WHERE id=?",
    [status, status, incidentId],
  );
  const [siblings] = await connection.execute(
    "SELECT id,status,department_id FROM reports WHERE incident_id=? AND id<>? AND status<>? AND anonymized_at IS NULL FOR UPDATE",
    [incidentId, exceptReportId, status],
  );
  const events = [];
  for (const sibling of siblings) {
    await setReportStatus(connection, sibling.id, status);
    const [audit] = await connection.execute(
      "INSERT INTO report_audit_log (report_id,actor_email,previous_status,new_status,note) VALUES (?,?,?,?,?)",
      [sibling.id, actor, sibling.status, status, note],
    );
    const eventKey = `audit:${audit.insertId}`;
    await queueStatusEmails(
      connection,
      sibling.id,
      eventKey,
      String(sibling.department_id) === String(actingDepartmentId) ? ["reporter"] : ["department", "reporter"],
    );
    events.push(eventKey);
  }
  return events;
}

// Call after a report's own status was changed and audited.
export async function syncIncidentStatus(connection, reportId, status, actor) {
  const [rows] = await connection.execute("SELECT incident_id,department_id,public_id FROM reports WHERE id=?", [reportId]);
  if (!rows[0]?.incident_id) return [];
  return applyStatus(connection, rows[0].incident_id, status, {
    actor,
    note: `Same problem as ${rows[0].public_id}; status shared across the grouped reports.`,
    exceptReportId: reportId,
    actingDepartmentId: rows[0].department_id,
  });
}

export async function recount(connection, incidentId) {
  await connection.execute(
    "UPDATE incidents i SET report_count=(SELECT COUNT(*) FROM reports r WHERE r.incident_id=i.id),upvote_count=(SELECT COUNT(*) FROM incident_votes v WHERE v.incident_id=i.id),comment_count=(SELECT COUNT(*) FROM incident_comments c WHERE c.incident_id=i.id AND c.status='approved'),first_reported_at=COALESCE((SELECT MIN(r.created_at) FROM reports r WHERE r.incident_id=i.id),first_reported_at),last_reported_at=COALESCE((SELECT MAX(r.created_at) FROM reports r WHERE r.incident_id=i.id),last_reported_at) WHERE i.id=?",
    [incidentId],
  );
}

export const logIncident = (connection, incidentId, actor, action, detail = "") =>
  connection.execute("INSERT INTO incident_events (incident_id,actor_email,action,detail) VALUES (?,?,?,?)", [
    incidentId,
    actor,
    action,
    detail.slice(0, 500),
  ]);

export class IncidentError extends Error {}

// Staff merge: every report, thumbs-up, comment and public photo of `source` moves to `target`.
// The merged incident takes the furthest open stage of the two; it is Resolved only if both were.
// The source stays as a pointer, so its public link redirects and the merge can be traced.
export async function mergeIncidents(connection, { sourceId, targetId, actor, actorId }) {
  if (String(sourceId) === String(targetId)) throw new IncidentError("same");
  const [locked] = await connection.execute(
    "SELECT id,ref,city_id,status,merged_into FROM incidents WHERE id IN (?,?) ORDER BY id FOR UPDATE",
    [sourceId, targetId],
  );
  const source = locked.find((row) => String(row.id) === String(sourceId));
  const target = locked.find((row) => String(row.id) === String(targetId));
  if (!source || !target || source.merged_into || target.merged_into) throw new IncidentError("unavailable");
  if (String(source.city_id) !== String(target.city_id)) throw new IncidentError("city");
  const bothResolved = source.status === "Resolved" && target.status === "Resolved";
  const open = [source.status, target.status].filter((s) => s !== "Resolved");
  const status = bothResolved
    ? "Resolved"
    : open.reduce((best, s) => (statusRank[s] > statusRank[best] ? s : best), "Pending");

  const [moved] = await connection.execute("SELECT id FROM reports WHERE incident_id=?", [source.id]);
  await connection.execute("UPDATE reports SET incident_id=?,incident_link='staff' WHERE incident_id=?", [target.id, source.id]);
  for (const { id } of moved) await queueFollowerPush(connection, id, "grouped", `grouped:${target.id}`);
  await connection.execute(
    "INSERT IGNORE INTO incident_votes (incident_id,voter_hash,created_at) SELECT ?,voter_hash,created_at FROM incident_votes WHERE incident_id=?",
    [target.id, source.id],
  );
  await connection.execute("DELETE FROM incident_votes WHERE incident_id=?", [source.id]);
  await connection.execute("UPDATE incident_comments SET incident_id=? WHERE incident_id=?", [target.id, source.id]);
  await connection.execute(
    "INSERT IGNORE INTO incident_public_images (incident_id,report_image_id) SELECT ?,report_image_id FROM incident_public_images WHERE incident_id=?",
    [target.id, source.id],
  );
  await connection.execute("DELETE FROM incident_public_images WHERE incident_id=?", [source.id]);
  // Other suggestions about the source now concern the target.
  for (const [from, to] of [
    ["incident_id", "candidate_id"],
    ["candidate_id", "incident_id"],
  ])
    await connection.execute(
      `INSERT IGNORE INTO incident_duplicate_candidates (${from},${to},distance_m,score,source,decision,decided_by,decided_at,created_at) SELECT ?,${to},distance_m,score,source,decision,decided_by,decided_at,created_at FROM incident_duplicate_candidates WHERE ${from}=? AND ${to}<>?`,
      [target.id, source.id, target.id],
    );
  await connection.execute(
    "DELETE FROM incident_duplicate_candidates WHERE (incident_id=? AND candidate_id<>?) OR (candidate_id=? AND incident_id<>?)",
    [source.id, target.id, source.id, target.id],
  );
  await connection.execute(
    "UPDATE incident_duplicate_candidates SET decision='merged',decided_by=?,decided_at=UTC_TIMESTAMP() WHERE (incident_id=? AND candidate_id=?) OR (incident_id=? AND candidate_id=?)",
    [actorId || null, source.id, target.id, target.id, source.id],
  );
  await connection.execute(
    "UPDATE incidents SET merged_into=?,visibility='hidden',report_count=0,upvote_count=0,comment_count=0 WHERE id=?",
    [target.id, source.id],
  );
  await recount(connection, target.id);
  const events = await applyStatus(connection, target.id, status, {
    actor,
    note: `Grouped with the same problem (issue ${target.ref}) by staff.`,
  });
  await logIncident(connection, target.id, actor, "merged_in", `Issue ${source.ref} merged into this one.`);
  await logIncident(connection, source.id, actor, "merged_out", `Merged into issue ${target.ref}.`);
  return { events, target };
}

// Staff split: one report leaves its group and becomes its own incident. The pair is
// remembered as "distinct" so it isn't suggested again.
export async function splitReport(connection, { reportId, actor, actorId }) {
  const [rows] = await connection.execute(
    "SELECT r.id,r.public_id,r.city_id,r.category,r.lat,r.lng,r.status,r.incident_id,i.ref,i.visibility,i.report_count,i.lat AS incident_lat,i.lng AS incident_lng FROM reports r JOIN incidents i ON i.id=r.incident_id WHERE r.id=? FOR UPDATE",
    [reportId],
  );
  const report = rows[0];
  if (!report) throw new IncidentError("unavailable");
  if (Number(report.report_count) < 2) throw new IncidentError("alone");
  const created = await insertIncident(connection, {
    cityId: report.city_id,
    category: report.category,
    lat: report.lat,
    lng: report.lng,
    status: report.status,
    visibility: report.visibility === "hidden" ? "hidden" : "listed",
    seedReportId: null,
  });
  await connection.execute("UPDATE reports SET incident_id=?,incident_link='staff' WHERE id=?", [created.id, report.id]);
  await connection.execute(
    "UPDATE incident_public_images p JOIN report_images i ON i.id=p.report_image_id SET p.incident_id=? WHERE p.incident_id=? AND i.report_id=?",
    [created.id, report.incident_id, report.id],
  );
  await recount(connection, report.incident_id);
  await recount(connection, created.id);
  const distance = Math.round(distanceM([Number(report.lat), Number(report.lng)], [Number(report.incident_lat), Number(report.incident_lng)]));
  await connection.execute(
    "INSERT INTO incident_duplicate_candidates (incident_id,candidate_id,distance_m,score,source,decision,decided_by,decided_at) VALUES (?,?,?,0,'system','distinct',?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE decision='distinct',decided_by=VALUES(decided_by),decided_at=VALUES(decided_at)",
    [created.id, report.incident_id, distance, actorId || null],
  );
  await logIncident(connection, report.incident_id, actor, "split", `${report.public_id} moved to its own issue ${created.ref}.`);
  await logIncident(connection, created.id, actor, "split_from", `${report.public_id} separated from issue ${report.ref}.`);
  return created;
}

// Everything the public incident page shows. Returns { redirect } for a merged incident,
// null for a missing or hidden one.
export async function publicIncident(db, ref, voter) {
  const [rows] = await db.execute(
    "SELECT i.id,i.ref,i.category,i.status,i.visibility,i.lat,i.lng,i.report_count,i.upvote_count,i.comment_count,i.public_summary,i.first_reported_at,i.last_reported_at,i.resolved_at,c.name AS city,target.ref AS merged_ref FROM incidents i JOIN cities c ON c.id=i.city_id LEFT JOIN incidents target ON target.id=i.merged_into WHERE i.ref=? LIMIT 1",
    [ref],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.merged_ref) return { redirect: row.merged_ref };
  if (row.visibility === "hidden") return null;
  const published = row.visibility === "public";
  const [[comments], [commentImages], [photos], [votes]] = await Promise.all([
    db.execute(
      "SELECT id,author_kind,author_name,body,created_at FROM incident_comments WHERE incident_id=? AND status='approved' ORDER BY created_at,id LIMIT 200",
      [row.id],
    ),
    db.execute(
      "SELECT m.id,m.comment_id FROM incident_comment_images m JOIN incident_comments c ON c.id=m.comment_id WHERE c.incident_id=? AND c.status='approved' ORDER BY m.comment_id,m.sort_order",
      [row.id],
    ),
    published
      ? db.execute(
          "SELECT p.report_image_id AS id FROM incident_public_images p JOIN report_image_storage s ON s.report_image_id=p.report_image_id WHERE p.incident_id=? ORDER BY p.report_image_id LIMIT 12",
          [row.id],
        )
      : [[]],
    voter
      ? db.execute("SELECT 1 FROM incident_votes WHERE incident_id=? AND voter_hash=? LIMIT 1", [row.id, voter])
      : [[]],
  ]);
  return {
    ...publicSummary(row),
    city: row.city,
    voted: votes.length > 0,
    photos: photos.map((photo) => `/api/incidents/${row.ref}/photos/r${photo.id}`),
    comments: comments.map((comment) => ({
      id: comment.id,
      staff: comment.author_kind === "staff",
      name: comment.author_name,
      body: comment.body,
      created_at: comment.created_at,
      photos: commentImages
        .filter((image) => String(image.comment_id) === String(comment.id))
        .map((image) => `/api/incidents/${row.ref}/photos/c${image.id}`),
    })),
  };
}

// Anonymous visitors: a random cookie identifies the browser for thumbs-up, hashed before storage.
export const VOTER_COOKIE = "kr-voter";
export const voterHash = (cookie) =>
  /^[A-Za-z0-9_-]{32,64}$/.test(cookie || "") ? sha256(`voter:${cookie}`) : null;
export const newVoterCookie = () => randomBytes(24).toString("base64url");

export function clientAddress(request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

// Fixed-window limit. Returns true while `name` has been used at most `max` times in `minutes`.
export async function withinLimit(db, name, max, minutes) {
  const bucket = sha256(`public:${name}`);
  await db.execute(
    "INSERT INTO public_rate_limits (bucket,attempts,window_started) VALUES (?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(window_started<UTC_TIMESTAMP()-INTERVAL ? MINUTE,1,LEAST(attempts+1,1000000)),window_started=IF(window_started<UTC_TIMESTAMP()-INTERVAL ? MINUTE,UTC_TIMESTAMP(),window_started)",
    [bucket, minutes, minutes],
  );
  const [rows] = await db.execute("SELECT attempts FROM public_rate_limits WHERE bucket=?", [bucket]);
  return Number(rows[0]?.attempts || 0) <= max;
}
