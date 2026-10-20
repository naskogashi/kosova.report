import { adminTranslator, adminLanguage } from "../../../lib/admin-language";
import { requireOwner } from "../../../lib/admin-session";
import { database } from "../../../lib/db";
import { siteTitle } from "../../../lib/site-branding";
import { localizedPath } from "../../../i18n/paths";
import AdminSubmit from "../AdminSubmit";
import { issueErrors } from "../issue-errors";
import { btn } from "../../../components/ui";
import { dismissDuplicateAction, mergeIncidentAction, moderateCommentAction } from "./actions";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await adminTranslator();
  return {
    title: `${t("Community")} | ${siteTitle(await adminLanguage())}`,
    robots: { index: false, follow: false },
  };
}

const labels = {
  infrastructure: "Infrastructure",
  environment: "Environment",
  public_services: "Public services",
  administration: "Administration",
  health: "Health",
  education: "Education",
  safety: "Safety",
};
const card = "rounded-lg bg-card shadow-[0_0_0_1px_var(--color-rule)]";

// The two queues that need a person: citizen comments waiting for approval,
// and reports that might be the same problem.
export default async function CommunityPage(props) {
  const searchParams = await props.searchParams;
  const t = await adminTranslator();
  const language = await adminLanguage();
  await requireOwner();
  let comments = [],
    images = [],
    candidates = [],
    unavailable = false;
  try {
    const db = database();
    [[comments], [images], [candidates]] = await Promise.all([
      db.execute(
        "SELECT c.id,c.author_name,c.body,c.language,c.created_at,i.ref,i.category,(SELECT MIN(r.id) FROM reports r WHERE r.incident_id=i.id) AS report_id FROM incident_comments c JOIN incidents i ON i.id=c.incident_id WHERE c.status='pending' ORDER BY c.created_at LIMIT 50",
      ),
      db.execute(
        "SELECT m.id,m.comment_id FROM incident_comment_images m JOIN incident_comments c ON c.id=m.comment_id WHERE c.status='pending' ORDER BY m.comment_id,m.sort_order",
      ),
      db.execute(
        "SELECT d.incident_id,d.candidate_id,d.distance_m,d.score,d.source,d.created_at,a.ref AS newer_ref,a.category AS newer_category,a.report_count AS newer_count,b.ref AS older_ref,b.category AS older_category,b.report_count AS older_count,b.status AS older_status,b.visibility AS older_visibility,(SELECT MIN(r.id) FROM reports r WHERE r.incident_id=a.id) AS newer_report,(SELECT MIN(r.id) FROM reports r WHERE r.incident_id=b.id) AS older_report FROM incident_duplicate_candidates d JOIN incidents a ON a.id=d.incident_id JOIN incidents b ON b.id=d.candidate_id WHERE d.decision='open' AND a.merged_into IS NULL AND b.merged_into IS NULL ORDER BY d.source='reporter_declined',d.score DESC,d.created_at LIMIT 50",
      ),
    ]);
  } catch (error) {
    console.error("Community queue unavailable", { code: error.code || "DATABASE_ERROR" });
    unavailable = true;
  }
  const format = (value) =>
    new Intl.DateTimeFormat(language === "sq" ? "sq-AL" : "en-GB", {
      timeZone: "Europe/Belgrade",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  const saved = {
    comment_approved: "Comment published.",
    comment_rejected: "Comment rejected.",
    merged: "Issues merged. Reporters whose status changed were emailed.",
    distinct: "Marked as different problems.",
    email_pending: "Changes saved. Some notification emails are pending.",
  }[searchParams.saved];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
      <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.025em]">{t("Community")}</h1>
      <p className="mt-1 text-pencil">{t("Comments waiting for approval and reports that may be the same problem.")}</p>
      {saved && <p role="status" className="mt-5 rounded-md bg-ok-wash p-3 font-semibold text-ok">{t(saved)}</p>}
      {searchParams.error && (
        <p role="alert" className="mt-5 rounded-md bg-error-wash p-3 font-semibold text-error">
          {t(issueErrors[searchParams.error] || "Changes could not be saved. Check the database and try again.")}
        </p>
      )}
      {unavailable ? (
        <section role="alert" className="mt-6 rounded-lg bg-error-wash p-6">
          <h2 className="font-extrabold">{t("Database unavailable")}</h2>
          <p className="mt-2">{t("Run the migrate command so migration 007 creates the incident tables.")}</p>
        </section>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <section className={`${card} p-5`} aria-labelledby="comments-title">
            <h2 id="comments-title" className="text-xl font-extrabold">
              {t("Comments to review")} <span className="tabular text-pencil">({comments.length})</span>
            </h2>
            <p className="mt-1 text-sm text-pencil">
              {t("Approve only comments about the problem itself. Reject insults, personal data, ads and anything about named people.")}
            </p>
            {!comments.length ? (
              <p className="mt-4 text-pencil">{t("Nothing waiting.")}</p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {comments.map((comment) => {
                  const own = images.filter((image) => String(image.comment_id) === String(comment.id));
                  return (
                    <li key={comment.id} className="rounded-md bg-paper p-4 shadow-[0_0_0_1px_var(--color-rule)]">
                      <p className="flex flex-wrap gap-x-2 text-sm text-pencil">
                        <b className="text-ink">{comment.author_name || t("No name")}</b>
                        <span className="tabular">{format(comment.created_at)}</span>
                        <span>· {comment.language.toUpperCase()}</span>
                        <a href={`/admin?report=${comment.report_id}`} className="font-bold text-blue underline underline-offset-4">
                          {t(labels[comment.category] || comment.category)} #{comment.ref}
                        </a>
                      </p>
                      <p className="mt-2 break-words whitespace-pre-wrap">{comment.body}</p>
                      {own.length > 0 && (
                        <ul className="mt-3 grid grid-cols-3 gap-2">
                          {own.map((image) => (
                            <li key={image.id}>
                              <a href={`/api/admin/comment-images/${image.id}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-sm">
                                <img src={`/api/admin/comment-images/${image.id}`} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={moderateCommentAction}>
                          <input type="hidden" name="comment_id" value={comment.id} />
                          <input type="hidden" name="decision" value="approved" />
                          <AdminSubmit>{t("Approve")}</AdminSubmit>
                        </form>
                        <form action={moderateCommentAction}>
                          <input type="hidden" name="comment_id" value={comment.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <button className={`${btn.soft} min-h-11 px-4 text-sm text-error`}>{t("Reject")}</button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={`${card} p-5`} aria-labelledby="duplicates-title">
            <h2 id="duplicates-title" className="text-xl font-extrabold">
              {t("Possible duplicates")} <span className="tabular text-pencil">({candidates.length})</span>
            </h2>
            <p className="mt-1 text-sm text-pencil">
              {t("Nearby and similar. Close is not proof: check the descriptions and photos before merging.")}
            </p>
            {!candidates.length ? (
              <p className="mt-4 text-pencil">{t("Nothing waiting.")}</p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {candidates.map((pair) => (
                  <li key={`${pair.incident_id}-${pair.candidate_id}`} className="rounded-md bg-paper p-4 shadow-[0_0_0_1px_var(--color-rule)]">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      {[
                        ["Newer", pair.newer_ref, pair.newer_category, pair.newer_count, pair.newer_report],
                        ["Earlier", pair.older_ref, pair.older_category, pair.older_count, pair.older_report],
                      ].map(([label, ref, category, count, reportId]) => (
                        <p key={label}>
                          <span className="block text-pencil">{t(label)}</span>
                          <a href={`/admin?report=${reportId}`} className="tabular font-bold text-blue underline underline-offset-4">
                            #{ref}
                          </a>{" "}
                          {t(labels[category] || category)} · {count} {t("reports")}
                        </p>
                      ))}
                    </div>
                    <p className="tabular mt-2 text-sm text-pencil">
                      {pair.distance_m} m · {t("score")} {Number(pair.score).toFixed(2)} · {format(pair.created_at)}
                    </p>
                    {pair.source === "reporter_declined" && (
                      <p className="mt-1 text-sm font-semibold text-stamp">{t("The reporter said this is a different problem.")}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={mergeIncidentAction}>
                        <input type="hidden" name="source_id" value={pair.incident_id} />
                        <input type="hidden" name="target_ref" value={pair.older_ref} />
                        <AdminSubmit>{t("Same problem: merge")}</AdminSubmit>
                      </form>
                      <form action={dismissDuplicateAction}>
                        <input type="hidden" name="incident_id" value={pair.incident_id} />
                        <input type="hidden" name="candidate_id" value={pair.candidate_id} />
                        <button className={`${btn.soft} min-h-11 px-4 text-sm`}>{t("Different problems")}</button>
                      </form>
                      {pair.older_visibility !== "hidden" && (
                        <a
                          href={localizedPath("/incident/[ref]", "sq", { ref: pair.older_ref })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${btn.link} text-sm`}
                        >
                          {t("Open public page")}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
