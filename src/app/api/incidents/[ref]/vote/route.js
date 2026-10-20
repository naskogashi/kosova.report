import { cookies } from "next/headers";
import { database } from "../../../../../lib/db";
import { siteConfig } from "../../../../../lib/admin-auth";
import { VOTER_COOKIE, clientAddress, newVoterCookie, voterHash, withinLimit } from "../../../../../lib/incidents";
import { validRef } from "../../../../../lib/incident-matching";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (error, status) => Response.json({ error }, { status, headers });

// Thumbs-up: "I see this problem too". One per browser, kept by a random cookie.
// POST adds it, DELETE takes it back. Resolved, hidden and merged incidents can't be voted on.
async function vote(request, props, add) {
  const { ref } = await props.params;
  if (request.headers.get("origin") !== siteConfig().origin) return fail("Origin not allowed", 403);
  if (!validRef(ref)) return fail("Not found", 404);
  const jar = await cookies();
  let cookie = jar.get(VOTER_COOKIE)?.value;
  if (!voterHash(cookie)) {
    if (!add) return Response.json({ voted: false }, { headers });
    cookie = newVoterCookie();
    jar.set(VOTER_COOKIE, cookie, {
      httpOnly: true,
      secure: siteConfig().secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  const voter = voterHash(cookie);
  let connection;
  try {
    const db = database();
    if (!(await withinLimit(db, `vote:${clientAddress(request)}`, 60, 60))) return fail("Too many requests", 429);
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT id,status FROM incidents WHERE ref=? AND merged_into IS NULL AND visibility<>'hidden' LIMIT 1 FOR UPDATE",
      [ref],
    );
    const incident = rows[0];
    if (!incident) {
      await connection.rollback();
      return fail("Not found", 404);
    }
    if (add && incident.status === "Resolved") {
      await connection.rollback();
      return fail("Incident resolved", 409);
    }
    const [result] = add
      ? await connection.execute("INSERT IGNORE INTO incident_votes (incident_id,voter_hash) VALUES (?,?)", [incident.id, voter])
      : await connection.execute("DELETE FROM incident_votes WHERE incident_id=? AND voter_hash=?", [incident.id, voter]);
    if (result.affectedRows)
      await connection.execute(
        `UPDATE incidents SET upvote_count=${add ? "upvote_count+1" : "IF(upvote_count>0,upvote_count-1,0)"} WHERE id=?`,
        [incident.id],
      );
    const [counts] = await connection.execute("SELECT upvote_count FROM incidents WHERE id=?", [incident.id]);
    await connection.commit();
    return Response.json({ voted: add, upvote_count: Number(counts[0].upvote_count) }, { headers });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("Vote failed", { code: error.code || "VOTE_ERROR" });
    return fail("Unavailable", 503);
  } finally {
    connection?.release();
  }
}
export const POST = (request, props) => vote(request, props, true);
export const DELETE = (request, props) => vote(request, props, false);
