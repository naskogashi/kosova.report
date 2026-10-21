import { siteTitle } from "../../lib/site-branding";
import { adminTranslator, adminLanguage } from "../../lib/admin-language";
import { database } from "../../lib/db";
import { requireAdmin } from "../../lib/admin-session";
import {
  updateReportAction,
  assignCheckerAction,
  reviewReportAction,
} from "./actions";
import AdminSubmit from "./AdminSubmit";
import AdminShortcuts from "./AdminShortcuts";
import IncidentPanel from "./IncidentPanel";
import { issueErrors } from "./issue-errors";
import { Icon, categoryStyle } from "../../components/icons";
import { btn, field } from "../../components/ui";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await adminTranslator();
  return {
    title: `${t("Admin panel")} | ${siteTitle(await adminLanguage())}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}
const statuses = {
  Pending: "Pending",
  "In Progress": "In progress",
  Resolved: "Resolved",
};
const labels = {
  infrastructure: "Infrastructure",
  environment: "Environment",
  public_services: "Public services",
  administration: "Administration",
  health: "Health",
  education: "Education",
  safety: "Safety",
};
const formatDate = (value, t) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "Europe/Belgrade",
      })
    : t("Not recorded");
export default async function AdminPage(props) {
  const searchParams = await props.searchParams;
  const t = await adminTranslator();
  const admin = await requireAdmin();
  const owner = admin.role === "owner";
  let checkers = [],
    assignment = null,
    reviews = [];
  const query =
    typeof searchParams.q === "string"
      ? searchParams.q.trim().slice(0, 100)
      : "";
  const status =
    typeof searchParams.status === "string" &&
    Object.hasOwn(statuses, searchParams.status)
      ? searchParams.status
      : "";
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(searchParams.page, 10) || 1),
  );
  const selected =
    typeof searchParams.report === "string" &&
    /^[1-9]\d{0,9}$/.test(searchParams.report)
      ? searchParams.report
      : null;
  let reports = [],
    departments = [],
    municipalities = [],
    routes = [],
    summary = [],
    total = 0,
    pending = 0,
    report = null,
    photos = [],
    files = [],
    history = [],
    incident = null,
    incidentDetail = { siblings: [], candidates: [], photos: [], events: [] },
    unavailable = false;
  try {
    const conditions = [],
      values = [];
    if (!owner) {
      conditions.push(
        "r.id IN (SELECT report_id FROM report_assignments WHERE account_id=?)",
      );
      values.push(admin.id);
    }
    if (status) {
      conditions.push("r.status=?");
      values.push(status);
    }
    if (query) {
      conditions.push("(r.public_id LIKE ? OR r.description LIKE ?)");
      values.push(`%${query}%`, `%${query}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const db = database();
    const results = await Promise.all([
      db.execute(
        `SELECT r.id,r.public_id,r.category,c.code AS city_code,r.status,r.created_at,i.report_count FROM reports r JOIN cities c ON c.id=r.city_id LEFT JOIN incidents i ON i.id=r.incident_id ${where} ORDER BY r.created_at DESC,r.id DESC LIMIT 25 OFFSET ${(page - 1) * 25}`,
        values,
      ),
      db.execute(`SELECT COUNT(*) AS total FROM reports r ${where}`, values),
      db.execute(
        `SELECT r.status,COUNT(*) AS total FROM reports r ${owner ? "" : "WHERE r.id IN (SELECT report_id FROM report_assignments WHERE account_id=?)"} GROUP BY r.status`,
        owner ? [] : [admin.id],
      ),
      db.execute(
        "SELECT d.id,d.city_id,d.name,d.notification_email,c.code AS city_code FROM departments d JOIN cities c ON c.id=d.city_id ORDER BY c.name,d.name",
      ),
      db.execute(
        `SELECT ((SELECT COUNT(*) FROM report_notifications n WHERE n.sent_at IS NULL ${owner ? "" : "AND n.report_id IN (SELECT report_id FROM report_assignments WHERE account_id=?)"})+(SELECT COUNT(*) FROM report_status_notifications n WHERE n.sent_at IS NULL ${owner ? "" : "AND n.report_id IN (SELECT report_id FROM report_assignments WHERE account_id=?)"})) AS total`,
        owner ? [] : [admin.id, admin.id],
      ),
      db.execute("SELECT id,code,name FROM cities ORDER BY name"),
      db.execute(
        "SELECT routing.city_id,routing.category,routing.department_id,routing.active,c.code AS city_code FROM department_routes routing JOIN cities c ON c.id=routing.city_id ORDER BY c.name,routing.category",
      ),
    ]);
    municipalities = results[5][0];
    routes = results[6][0];
    reports = results[0][0];
    total = Number(results[1][0][0].total);
    summary = results[2][0];
    departments = results[3][0];
    pending = Number(results[4][0][0].total);
    if (owner) {
      const [staff] = await db.execute(
        "SELECT id,name,email FROM staff_accounts WHERE role='checker' AND active=1 AND must_change_password=0",
      );
      checkers = staff;
    }
    if (selected) {
      const [rows] = await db.execute(
        "SELECT r.id,r.public_id,c.code AS city_code,r.category,r.status,r.description,r.lat AS latitude,r.lng AS longitude,r.created_at,r.is_anonymous AS anonymous,r.reporter_email AS contact_email,r.admin_note,d.notification_email FROM reports r JOIN departments d ON d.id=r.department_id JOIN cities c ON c.id=r.city_id WHERE r.id=? AND (?=1 OR EXISTS(SELECT 1 FROM report_assignments a WHERE a.report_id=r.id AND a.account_id=?)) LIMIT 1",
        [selected, owner ? 1 : 0, admin.id],
      );
      report = rows[0] || null;
      if (report) {
        const [assigned] = await db.execute(
          "SELECT account_id FROM report_assignments WHERE report_id=?",
          [selected],
        );
        assignment = assigned[0]?.account_id;
        const [checked] = await db.execute(
          "SELECT a.name,r.note,r.checked_at FROM report_reviews r JOIN staff_accounts a ON a.id=r.account_id WHERE r.report_id=?",
          [selected],
        );
        reviews = checked;
        const detail = await Promise.all([
          db.execute(
            "SELECT id FROM report_images WHERE report_id=? ORDER BY id",
            [selected],
          ),
          db.execute(
            "SELECT actor_email,previous_status,new_status,note,created_at FROM report_audit_log WHERE report_id=? ORDER BY id DESC LIMIT 20",
            [selected],
          ),
          db.execute(
            "SELECT id,kind FROM attachments WHERE report_id=? AND kind IN ('video','pdf') AND state<>'deleted' ORDER BY sort_order",
            [selected],
          ),
        ]);
        photos = detail[0][0];
        history = detail[1][0];
        files = detail[2][0];
        const [incidents] = await db.execute(
          "SELECT i.id,i.ref,i.status,i.visibility,i.public_summary,i.report_count,i.upvote_count,i.comment_count FROM incidents i JOIN reports r ON r.incident_id=i.id WHERE r.id=?",
          [selected],
        );
        incident = incidents[0] || null;
        // Other reports, suggestions and photos of the issue are for owners: checkers only see their assigned reports.
        if (incident && owner) {
          const grouped = await Promise.all([
            db.execute("SELECT id,public_id,status,created_at,incident_link FROM reports WHERE incident_id=? ORDER BY created_at,id LIMIT 50", [incident.id]),
            db.execute(
              "SELECT d.incident_id,d.candidate_id,d.distance_m,d.score,d.source,a.id AS newer_id,a.ref AS newer_ref,b.ref AS older_ref,other.ref AS other_ref,other.category,other.status,other.report_count,(SELECT MIN(x.id) FROM reports x WHERE x.incident_id=other.id) AS report_id FROM incident_duplicate_candidates d JOIN incidents a ON a.id=d.incident_id JOIN incidents b ON b.id=d.candidate_id JOIN incidents other ON other.id=IF(d.incident_id=?,d.candidate_id,d.incident_id) WHERE (d.incident_id=? OR d.candidate_id=?) AND d.decision='open' AND a.merged_into IS NULL AND b.merged_into IS NULL ORDER BY d.score DESC LIMIT 10",
              [incident.id, incident.id, incident.id],
            ),
            db.execute(
              "SELECT i.id,(p.report_image_id IS NOT NULL) AS public FROM report_images i JOIN reports r ON r.id=i.report_id JOIN report_image_storage s ON s.report_image_id=i.id LEFT JOIN incident_public_images p ON p.report_image_id=i.id AND p.incident_id=? WHERE r.incident_id=? ORDER BY i.id LIMIT 40",
              [incident.id, incident.id],
            ),
            db.execute("SELECT actor_email,action,detail,created_at FROM incident_events WHERE incident_id=? ORDER BY id DESC LIMIT 10", [incident.id]),
          ]);
          incidentDetail = {
            siblings: grouped[0][0],
            candidates: grouped[1][0],
            photos: grouped[2][0],
            events: grouped[3][0],
          };
        }
      }
    }
  } catch (error) {
    console.error("Admin dashboard unavailable", {
      code: error.code || "DATABASE_ERROR",
    });
    unavailable = true;
  }
  const browse = (nextPage, reportId) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    params.set("page", String(nextPage));
    if (reportId) params.set("report", reportId);
    return `/admin?${params}`;
  };
  const cityName = (code) =>
    municipalities.find((item) => item.code === code)?.name || code;
  const chip =
    "inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-bold transition-colors duration-120";
  const card = "rounded-lg bg-card shadow-[0_0_0_1px_var(--color-rule)]";
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
      <AdminShortcuts />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-0.025em]">{t("Report inbox")}</h1>
          <p className="mt-1 text-pencil">
            {t("Review evidence, update report progress and configure institutional routing.")}
          </p>
        </div>
        <p className="text-sm text-pencil">
          {admin.email}
          <span className="ml-3 hidden lg:inline">{t("Keyboard: j and k move between reports, / searches.")}</span>
        </p>
      </div>
      {searchParams.error && issueErrors[searchParams.error] && (
        <p role="alert" className="mt-5 rounded-md bg-error-wash p-3 font-semibold text-error">
          {t(issueErrors[searchParams.error])}
        </p>
      )}
      {searchParams.saved && (
        <p role="status" className="mt-5 rounded-md bg-ok-wash p-3 font-semibold text-ok">
          {searchParams.saved === "email_pending"
            ? t("Changes saved. Some notification emails are pending.")
            : t("Changes saved.")}
        </p>
      )}
      {searchParams.error && !issueErrors[searchParams.error] && (
        <p role="alert" className="mt-5 rounded-md bg-error-wash p-3 font-semibold text-error">
          {t("Changes could not be saved. Check the database and try again.")}
        </p>
      )}
      {unavailable ? (
        <section role="alert" className="mt-6 rounded-lg bg-error-wash p-6">
          <h2 className="font-extrabold">{t("Database unavailable")}</h2>
          <p className="mt-2">
            {t("Check the MySQL environment settings and run the platform setup command (migrations 004 and 005).")}
          </p>
        </section>
      ) : (
        <>
          {/* Status filters as chips, with counts; the search sits beside them. */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <a href="/admin" aria-current={!status ? "true" : undefined} className={`${chip} bg-card text-ink shadow-[0_0_0_1px_var(--color-rule)] aria-[current=true]:bg-ink aria-[current=true]:text-paper aria-[current=true]:shadow-none`}>
              {t("All statuses")}
            </a>
            {Object.entries(statuses).map(([key, label]) => (
              <a
                key={key}
                href={`/admin?status=${encodeURIComponent(key)}`}
                aria-current={status === key ? "true" : undefined}
                className={`${chip} bg-card text-ink shadow-[0_0_0_1px_var(--color-rule)] aria-[current=true]:bg-ink aria-[current=true]:text-paper aria-[current=true]:shadow-none`}
              >
                {t(label)}
                <span className="tabular rounded-full bg-wash px-2 text-xs text-blue">
                  {Number(summary.find((row) => row.status === key)?.total || 0)}
                </span>
              </a>
            ))}
            {pending > 0 && (
              <span className={`${chip} bg-wash text-stamp`}>
                {t("Pending email alerts")}
                <span className="tabular">{pending}</span>
              </span>
            )}
            <form method="GET" action="/admin" className="ml-auto flex w-full gap-2 sm:w-auto">
              {status && <input type="hidden" name="status" value={status} />}
              <label className="flex-1 sm:w-72">
                <span className="sr-only">{t("Search reports")}</span>
                <input
                  id="admin-search"
                  className={`${field.input} mt-0 min-h-11 py-2`}
                  name="q"
                  type="search"
                  defaultValue={query}
                  maxLength={100}
                  placeholder={t("Search public ID or description")}
                />
              </label>
              <button className={`${btn.primary} min-h-11 px-4 text-sm`}>{t("Search")}</button>
            </form>
          </div>

          {/* Work mode: the list on the left, the selected report on the right. */}
          <div className={`mt-6 grid items-start gap-6 ${report ? "lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" : ""}`}>
            <section className={`${card} min-w-0 overflow-hidden`} aria-labelledby="inbox-list">
              <div className="flex items-center justify-between px-4 py-3 shadow-[0_1px_0_var(--color-rule)]">
                <h2 id="inbox-list" className="font-extrabold">{t("Reports")}</h2>
                <span className="tabular text-sm text-pencil">
                  {total} {t("matching")}
                </span>
              </div>
              {!reports.length ? (
                <p className="p-6 text-pencil">{t("No reports match your filters.")}</p>
              ) : (
                <ul data-inbox>
                  {reports.map((row) => {
                    const style = categoryStyle[row.category];
                    const current = selected === String(row.id);
                    return (
                      <li key={row.id} className="shadow-[0_1px_0_var(--color-rule)] last:shadow-none">
                        <a
                          href={browse(page, row.id)}
                          aria-current={current ? "true" : undefined}
                          data-inbox-item
                          className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-wash aria-[current=true]:bg-wash aria-[current=true]:shadow-[inset_4px_0_0_var(--color-blue)]"
                        >
                          <span className={`flex size-10 items-center justify-center rounded-sm ${style?.text || "text-ink"} ${style?.tint || "bg-wash"}`}>
                            {style && <Icon name={row.category} className="size-6" />}
                          </span>
                          <span className="min-w-0">
                            <span className="tabular flex items-center gap-2 font-extrabold">
                              {row.public_id}
                              {Number(row.report_count) > 1 && (
                                <span title={t("Reports of this problem")} className="inline-flex items-center gap-1 rounded-full bg-wash px-2 text-xs text-blue">
                                  <Icon name="group" className="size-3.5" />×{row.report_count}
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-sm text-pencil">
                              {t(labels[row.category] || row.category)}, {cityName(row.city_code)}
                            </span>
                          </span>
                          <span className="text-right text-xs">
                            <span className={`inline-block rounded-full px-2 py-0.5 font-bold ${row.status === "Resolved" ? "bg-ok-wash text-ok" : row.status === "In Progress" ? "bg-wash text-blue" : "bg-paper text-pencil"}`}>
                              {t(statuses[row.status] || row.status)}
                            </span>
                            <span className="tabular mt-1 block text-pencil">{formatDate(row.created_at, t)}</span>
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm shadow-[0_-1px_0_var(--color-rule)]">
                {page > 1 ? (
                  <a className={btn.link} href={browse(page - 1)}>
                    {t("Previous")}
                  </a>
                ) : (
                  <span />
                )}
                <span className="tabular text-pencil">
                  {t("Page")} {page}
                </span>
                {page * 25 < total ? (
                  <a className={btn.link} href={browse(page + 1)}>
                    {t("Next")}
                  </a>
                ) : (
                  <span />
                )}
              </div>
            </section>

            {report && (
              <section className="grid min-w-0 gap-5" aria-labelledby="report-title">
                {/* The report as the same slip citizens see. */}
                <article className={`${card} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 id="report-title" className="tabular text-2xl font-extrabold tracking-[-0.01em]">
                        {report.public_id}
                      </h2>
                      <p className="mt-1 text-sm text-pencil">
                        {t("Submitted")} {formatDate(report.created_at, t)}
                      </p>
                    </div>
                    {categoryStyle[report.category] && (
                      <span className={`inline-flex -rotate-2 items-center gap-2 rounded-sm border-[1.5px] border-current/45 px-3 py-1.5 font-extrabold ${categoryStyle[report.category].text} ${categoryStyle[report.category].tint}`}>
                        <Icon name={report.category} className="size-6" />
                        {t(labels[report.category] || report.category)}
                      </span>
                    )}
                  </div>
                  <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-pencil">{t("Reporter")}</dt>
                      <dd className="font-semibold break-words">{report.anonymous ? t("Anonymous") : report.contact_email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-pencil">{t("Department notification")}</dt>
                      <dd className="font-semibold break-words">{report.notification_email}</dd>
                    </div>
                  </dl>
                  <p className="ruled mt-5 text-[1.0625rem] break-words whitespace-pre-wrap">{report.description}</p>
                  <a
                    className={`${btn.soft} mt-5 min-h-11 px-4 text-sm`}
                    href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=17/${report.latitude}/${report.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="pin" className="size-5" />
                    {t("View location \xB7")} <span className="tabular">{report.latitude}, {report.longitude}</span>
                  </a>
                  {photos.length > 0 && (
                    <div className="mt-5">
                      <h3 className="font-extrabold">
                        {t("Evidence \xB7")} {photos.length}
                      </h3>
                      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {photos.map((photo) => (
                          <li key={photo.id}>
                            <a href={`/api/admin/images/${photo.id}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md">
                              <img src={`/api/admin/images/${photo.id}`} alt={t("Report evidence")} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {files.length > 0 && (
                    <div className="mt-5">
                      <h3 className="font-extrabold">
                        {t("Video and documents ·")} {files.length}
                      </h3>
                      <ul className="mt-3 grid gap-2">
                        {files.map((file, index) => (
                          <li key={file.id}>
                            <a href={`/api/admin/attachments/${file.id}`} target="_blank" rel="noopener noreferrer" className={btn.soft}>
                              <Icon name={file.kind === "video" ? "video" : "document"} className="size-5" />
                              {file.kind === "video" ? t("Video (5 seconds, no sound)") : `${t("PDF document")} ${index + 1}`}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>

                {incident && (
                  <IncidentPanel
                    t={t}
                    owner={owner}
                    reportId={report.id}
                    incident={incident}
                    {...incidentDetail}
                    formatDate={formatDate}
                    labels={labels}
                    statuses={statuses}
                  />
                )}

                {owner && (
                  <form action={updateReportAction} className={`${card} grid gap-4 p-5`}>
                    <input type="hidden" name="id" value={report.id} />
                    <fieldset>
                      <legend className={field.label}>{t("Status")}</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(statuses).map(([key, label]) => (
                          <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-rule bg-card px-4 font-bold has-checked:border-blue has-checked:bg-wash has-checked:text-blue has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue">
                            <input type="radio" name="status" value={key} defaultChecked={report.status === key} className="sr-only" />
                            {t(label)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className={field.label}>
                      {t("Internal note")}
                      <span className={field.hint}>{t("For authorized staff. Every save is recorded in report history.")}</span>
                      <textarea name="note" rows={4} maxLength={5000} defaultValue={report.admin_note || ""} className={field.input} />
                    </label>
                    <div>
                      <AdminSubmit>{t("Save report")}</AdminSubmit>
                    </div>
                  </form>
                )}

                <div className="grid gap-5 xl:grid-cols-2">
                  <form action={reviewReportAction} className={`${card} grid gap-3 p-5`}>
                    <input type="hidden" name="report_id" value={report.id} />
                    <label className={field.label}>
                      {t("Check / verify report")}
                      <textarea name="note" required rows={3} maxLength={5000} className={field.input} />
                    </label>
                    <div>
                      <AdminSubmit>{t("Mark report checked")}</AdminSubmit>
                    </div>
                    {reviews.length > 0 && (
                      <ul className="mt-2 grid gap-2">
                        {reviews.map((review, index) => (
                          <li key={index} className="rounded-md bg-ok-wash p-3 text-sm">
                            <strong>{review.name}</strong>, <span className="tabular">{formatDate(review.checked_at, t)}</span>
                            <p className="mt-1 whitespace-pre-wrap">{review.note}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </form>
                  {owner && (
                    <form action={assignCheckerAction} className={`${card} grid gap-3 p-5`}>
                      <input type="hidden" name="report_id" value={report.id} />
                      <label className={field.label}>
                        {t("Assign report checker")}
                        <select name="account_id" required defaultValue={assignment || ""} className={field.input}>
                          <option value="">{t("Choose a checker")}</option>
                          {checkers.map((checker) => (
                            <option key={checker.id} value={checker.id}>
                              {checker.name} ({checker.email})
                            </option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <AdminSubmit>{t("Assign checker")}</AdminSubmit>
                      </div>
                    </form>
                  )}
                </div>

                {history.length > 0 && (
                  <section className={`${card} p-5`} aria-labelledby="history-title">
                    <h3 id="history-title" className="font-extrabold">{t("Recent history")}</h3>
                    <ol className="mt-3 grid gap-3">
                      {history.map((item, index) => (
                        <li key={index} className="grid grid-cols-[0.75rem_1fr] gap-3">
                          <span aria-hidden="true" className="mt-1.5 size-3 rounded-full bg-blue" />
                          <span className="text-sm">
                            <span className="block font-bold">
                              {t(statuses[item.previous_status])} → {t(statuses[item.new_status])}
                            </span>
                            <span className="block break-words text-pencil">
                              {item.actor_email}, <span className="tabular">{formatDate(item.created_at, t)}</span>
                            </span>
                            {item.note && <span className="mt-1 block whitespace-pre-wrap break-words">{item.note}</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </section>
            )}
          </div>
          {selected && !report && (
            <p role="status" className="mt-4 text-pencil">
              {t("The selected report could not be found.")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
