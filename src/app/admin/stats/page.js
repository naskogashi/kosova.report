import AdminNav from "../AdminNav";
import { siteTitle } from "../../../lib/site-branding";
import { adminTranslator, adminLanguage } from "../../../lib/admin-language";
import { database } from "../../../lib/db";
import { requireAdmin } from "../../../lib/admin-session";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await adminTranslator();
  return {
    title: `${t("Statistics")} | ${siteTitle(await adminLanguage())}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}
export default async function Stats() {
  const t = await adminTranslator();
  const account = await requireAdmin(),
    owner = account.role === "owner",
    where = owner
      ? ""
      : "WHERE r.id IN (SELECT report_id FROM report_assignments WHERE account_id=?)",
    values = owner ? [] : [account.id];
  let totals = {},
    departments = [],
    daily = [],
    checkers = [];
  try {
    const results = await Promise.all([
      database().execute(
        `SELECT COUNT(*) AS total,SUM(r.status='Pending') AS pending,SUM(r.status='In Progress') AS handling,SUM(r.status='Resolved') AS resolved,AVG(CASE WHEN r.resolved_at IS NOT NULL AND r.created_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND,r.created_at,r.resolved_at)/86400 END) AS resolution_days FROM reports r ${where}`,
        values,
      ),
      database().execute(
        `SELECT d.name,COUNT(*) AS total,SUM(r.status='Resolved') AS resolved FROM reports r JOIN departments d ON d.id=r.department_id ${where} GROUP BY d.id,d.name ORDER BY total DESC`,
        values,
      ),
      database().execute(
        `SELECT DATE(r.created_at) AS day,COUNT(*) AS total FROM reports r ${where ? where + " AND" : "WHERE"} r.created_at>=UTC_TIMESTAMP()-INTERVAL 30 DAY GROUP BY DATE(r.created_at) ORDER BY day`,
        values,
      ),
      database().execute(
        `SELECT a.name,a.email,(SELECT COUNT(*) FROM report_assignments assignment WHERE assignment.account_id=a.id) AS assigned,(SELECT COUNT(*) FROM report_reviews review WHERE review.account_id=a.id) AS checked FROM staff_accounts a WHERE a.role='checker' ${owner ? "" : "AND a.id=?"} ORDER BY a.name`,
        values,
      ),
    ]);
    totals = results[0][0][0];
    departments = results[1][0];
    daily = results[2][0];
    checkers = results[3][0];
  } catch {
    return (
      <div className="p-8">
        {t("Statistics unavailable. Check database setup.")}
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-5 py-8">
      <AdminNav current="/admin/stats" t={t} owner={owner} />
      <h1 className="text-3xl font-extrabold tracking-[-0.025em]">
        {owner ? t("Platform statistics") : t("My assigned reports")}
      </h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          [t("Total reports"), totals.total],
          [t("Pending"), totals.pending],
          [t("Being handled"), totals.handling],
          [t("Resolved"), totals.resolved],
          [
            t("Avg. days to resolve"),
            totals.resolution_days == null
              ? "—"
              : Number(totals.resolution_days).toFixed(1),
          ],
        ].map(([label, value]) => (
          <div key={t(label)} className="rounded-md border bg-card p-5">
            <p className="text-xs text-pencil">{t(label)}</p>
            <p className="mt-3 text-2xl font-bold text-ink">
              {value ?? 0}
            </p>
          </div>
        ))}
      </div>
      <section className="rounded-md border bg-card p-5">
        <h2 className="text-xl font-semibold">
          {" "}
          {t("Checker workload and completed checks")}{" "}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3">{t("Checker")}</th>
                <th>{t("Currently assigned")}</th>
                <th>{t("Distinct reports checked")}</th>
              </tr>
            </thead>
            <tbody>
              {checkers.map((checker, index) => (
                <tr key={index} className="border-b">
                  <td className="py-3">
                    {checker.name}
                    <span className="block text-xs text-pencil">
                      {checker.email}
                    </span>
                  </td>
                  <td>{checker.assigned}</td>
                  <td>{checker.checked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-md border bg-card p-5">
        <h2 className="text-xl font-semibold">{t("Department performance")}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3">{t("Department")}</th>
                <th>{t("Reports")}</th>
                <th>{t("Resolved")}</th>
                <th>{t("Resolution rate")}</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department, index) => (
                <tr key={index} className="border-b">
                  <td className="py-3">{department.name}</td>
                  <td>{department.total}</td>
                  <td>{department.resolved || 0}</td>
                  <td>
                    {Math.round(
                      (Number(department.resolved || 0) /
                        Number(department.total)) *
                        100,
                    )}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-md border bg-card p-5">
        <h2 className="text-xl font-semibold">
          {" "}
          {t("New reports \xB7 last 30 days (UTC)")}{" "}
        </h2>
        <div className="mt-5 space-y-3">
          {daily.map((day, index) => (
            <div
              key={index}
              className="grid grid-cols-[100px_1fr_40px] items-center gap-3 text-xs"
            >
              <span>{new Date(day.day).toISOString().slice(0, 10)}</span>
              <div className="h-4 rounded bg-wash">
                <div
                  className="h-4 rounded bg-blue"
                  style={{
                    width: `${Math.max(2, (Number(day.total) / Math.max(...daily.map((item) => Number(item.total)))) * 100)}%`,
                  }}
                />
              </div>
              <span>{day.total}</span>
            </div>
          ))}
          {!daily.length && (
            <p className="text-sm text-pencil">
              {t("No reports in this period.")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
