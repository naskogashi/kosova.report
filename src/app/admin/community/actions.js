"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { database } from "../../../lib/db";
import { requireOwner } from "../../../lib/admin-session";
import { siteConfig } from "../../../lib/admin-auth";
import { deliverStatusEmails } from "../../../lib/report-notifications";
import { IncidentError, logIncident, mergeIncidents, splitReport } from "../../../lib/incidents";
import { validRef } from "../../../lib/incident-matching";

// Grouping, publication and comment moderation. Owners only: these change what the public sees
// and which reporters get which status emails.
async function assertOrigin() {
  if ((await headers()).get("origin") !== siteConfig().origin) throw new Error("Request origin not allowed");
}
const text = (form, key, max) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};
const validId = (value) => /^[1-9]\d{0,9}$/.test(String(value));
// Actions run from a report page go back to it; the rest go back to the community queue.
function done(form, query) {
  const report = text(form, "back", 10);
  revalidatePath("/admin");
  revalidatePath("/admin/community");
  redirect(validId(report) ? `/admin?report=${report}&${query}` : `/admin/community?${query}`);
}

async function inTransaction(work) {
  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Merge one incident into another. The target is given by its public reference,
// so staff can paste it from the incident page or a suggestion.
export async function mergeIncidentAction(form) {
  await assertOrigin();
  const account = await requireOwner();
  const sourceId = text(form, "source_id", 10),
    targetRef = text(form, "target_ref", 10).toLowerCase();
  if (!validId(sourceId) || !validRef(targetRef)) done(form, "error=merge_ref");
  let events = [],
    failure = "";
  try {
    const [targets] = await database().execute("SELECT id FROM incidents WHERE ref=? LIMIT 1", [targetRef]);
    if (!targets.length) throw new IncidentError("unavailable");
    ({ events } = await inTransaction((connection) =>
      mergeIncidents(connection, { sourceId, targetId: targets[0].id, actor: account.email, actorId: account.id }),
    ));
  } catch (error) {
    failure = error instanceof IncidentError ? error.message : "database";
    if (!(error instanceof IncidentError)) console.error("Incident merge failed", { code: error.code || "MERGE_ERROR" });
  }
  if (failure) done(form, `error=merge_${failure}`);
  let pending = 0;
  for (const key of events) {
    try {
      pending += (await deliverStatusEmails(key)).pending;
    } catch {
      pending++;
    }
  }
  done(form, pending ? "saved=email_pending" : "saved=merged");
}

// "Not the same problem": the pair is remembered and never suggested again.
export async function dismissDuplicateAction(form) {
  await assertOrigin();
  const account = await requireOwner();
  const incidentId = text(form, "incident_id", 10),
    candidateId = text(form, "candidate_id", 10);
  if (!validId(incidentId) || !validId(candidateId)) throw new Error("Invalid suggestion");
  await database().execute(
    "UPDATE incident_duplicate_candidates SET decision='distinct',decided_by=?,decided_at=UTC_TIMESTAMP() WHERE incident_id=? AND candidate_id=?",
    [account.id, incidentId, candidateId],
  );
  done(form, "saved=distinct");
}

// Undo a wrong grouping: the report becomes its own incident again.
export async function splitReportAction(form) {
  await assertOrigin();
  const account = await requireOwner();
  const reportId = text(form, "report_id", 10);
  if (!validId(reportId)) throw new Error("Invalid report");
  let failure = "";
  try {
    await inTransaction((connection) => splitReport(connection, { reportId, actor: account.email, actorId: account.id }));
  } catch (error) {
    failure = error instanceof IncidentError ? error.message : "database";
  }
  done(form, failure ? `error=split_${failure}` : "saved=split");
}

// What the public sees. Photos are chosen one by one from the grouped reports' evidence.
export async function publishIncidentAction(form) {
  await assertOrigin();
  const account = await requireOwner();
  const incidentId = text(form, "incident_id", 10),
    visibility = text(form, "visibility", 10),
    summary = text(form, "summary", 600);
  const photos = form.getAll("photo").filter((value) => validId(value)).slice(0, 12);
  if (!validId(incidentId) || !["hidden", "listed", "public"].includes(visibility)) throw new Error("Invalid publication");
  if (visibility === "public" && summary.length < 10) done(form, "error=summary");
  await inTransaction(async (connection) => {
    const [rows] = await connection.execute("SELECT visibility FROM incidents WHERE id=? AND merged_into IS NULL FOR UPDATE", [incidentId]);
    if (!rows.length) throw new Error("Incident unavailable");
    await connection.execute("UPDATE incidents SET visibility=?,public_summary=? WHERE id=?", [visibility, summary, incidentId]);
    await connection.execute("DELETE FROM incident_public_images WHERE incident_id=?", [incidentId]);
    // Only photos that belong to this incident's reports and are stored in R2.
    for (const photo of visibility === "public" ? photos : [])
      await connection.execute(
        "INSERT IGNORE INTO incident_public_images (incident_id,report_image_id) SELECT r.incident_id,i.id FROM report_images i JOIN reports r ON r.id=i.report_id JOIN report_image_storage s ON s.report_image_id=i.id WHERE i.id=? AND r.incident_id=?",
        [photo, incidentId],
      );
    await logIncident(connection, incidentId, account.email, "visibility", `${rows[0].visibility} → ${visibility}`);
  });
  done(form, "saved=published");
}

export async function moderateCommentAction(form) {
  await assertOrigin();
  const account = await requireOwner();
  const commentId = text(form, "comment_id", 10),
    decision = text(form, "decision", 10);
  if (!validId(commentId) || !["approved", "rejected"].includes(decision)) throw new Error("Invalid moderation");
  await inTransaction(async (connection) => {
    const [rows] = await connection.execute("SELECT incident_id FROM incident_comments WHERE id=? FOR UPDATE", [commentId]);
    if (!rows.length) throw new Error("Comment unavailable");
    await connection.execute(
      "UPDATE incident_comments SET status=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?",
      [decision, account.id, commentId],
    );
    await connection.execute(
      "UPDATE incidents SET comment_count=(SELECT COUNT(*) FROM incident_comments WHERE incident_id=? AND status='approved') WHERE id=?",
      [rows[0].incident_id, rows[0].incident_id],
    );
  });
  done(form, `saved=comment_${decision}`);
}

// An official update from staff, published at once and marked as coming from the team.
export async function staffCommentAction(form) {
  await assertOrigin();
  const account = await requireOwner();
  const incidentId = text(form, "incident_id", 10),
    body = text(form, "body", 2000);
  if (!validId(incidentId)) throw new Error("Invalid incident");
  if (body.length < 2) done(form, "error=comment");
  await inTransaction(async (connection) => {
    await connection.execute(
      "INSERT INTO incident_comments (incident_id,author_kind,author_name,staff_account_id,body,language,status,reviewed_by,reviewed_at) VALUES (?,'staff',?,?,?,'sq','approved',?,UTC_TIMESTAMP())",
      // Shown publicly as "the kosova.report team", not under a staff member's own name.
      [incidentId, "", account.id, body, account.id],
    );
    await connection.execute("UPDATE incidents SET comment_count=comment_count+1 WHERE id=?", [incidentId]);
  });
  done(form, "saved=comment_posted");
}
