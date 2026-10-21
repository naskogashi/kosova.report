import { CategoryBars, DailyColumns, DepartmentBars, StatusSplit } from "../../../components/Charts";
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
    checkers = [],
    byCategory = [];
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
        `SELECT r.category,COUNT(*) AS total FROM reports r ${where} GROUP BY r.category`,
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
    byCategory = results[3][0];
    checkers = results[4][0];
  } catch {
    return (
      <div className="p-8">
        {t("Statistics unavailable. Check database setup.")}
      </div>
    );
  }
  const language = await adminLanguage();
  const locale = language === "sq" ? "sq-AL" : "en-GB";
  const n = (value) => Number(value || 0);
  // The last 30 days, quiet days included as zero.
  const counts = new Map(daily.map((row) => [new Date(row.day).toISOString().slice(0, 10), n(row.total)]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
    return { day, total: counts.get(day) || 0 };
  });
  const categoryLabels = {
    infrastructure: "Infrastructure",
    environment: "Environment",
    public_services: "Public services",
    administration: "Administration",
    health: "Health",
    education: "Education",
    safety: "Safety",
  };
  const categoryRows = Object.keys(categoryLabels)
    .map((key) => ({ key, label: t(categoryLabels[key]), value: n(byCategory.find((row) => row.category === key)?.total) }))
    .sort((a, b) => b.value - a.value);
  const card = "rounded-lg bg-card p-5 shadow-[0_0_0_1px_var(--color-rule)] sm:p-6";
  const tableToggle = "mt-5 [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:py-2 [&_summary]:font-bold [&_summary]:text-blue";
  return (
    <div className="mx-auto w-full max-w-7xl *:max-w-6xl space-y-7 px-4 pt-6 pb-8 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-[-0.025em]">
        {owner ? t("Platform statistics") : t("My assigned reports")}
      </h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          [t("Total reports"), n(totals.total)],
          [t("Pending"), n(totals.pending)],
          [t("Being handled"), n(totals.handling)],
          [t("Resolved"), n(totals.resolved)],
          [t("Avg. days to resolve"), totals.resolution_days == null ? "—" : Number(totals.resolution_days).toFixed(1)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-card p-4 shadow-[0_0_0_1px_var(--color-rule)]">
            <p className="text-sm text-pencil">{label}</p>
            <p className="tabular mt-2 text-3xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>

      <section className={card} aria-labelledby="stages-title">
        <h2 id="stages-title" className="text-xl font-extrabold">{t("Where reports stand")}</h2>
        <div className="mt-4">
          <StatusSplit
            label={t("Where reports stand")}
            total={`${t("Total reports")}: ${n(totals.total)}`}
            parts={[
              { key: "Pending", label: t("Not resolved"), value: n(totals.pending), color: "var(--color-chart-1)" },
              { key: "In Progress", label: t("Being resolved"), value: n(totals.handling), color: "var(--color-chart-2)" },
              { key: "Resolved", label: t("Resolved"), value: n(totals.resolved), color: "var(--color-chart-3)" },
            ]}
          />
        </div>
      </section>

      <section className={card} aria-labelledby="daily-title">
        <h2 id="daily-title" className="text-xl font-extrabold">{t("New reports, last 30 days")}</h2>
        <div className="mt-6">
          <DailyColumns days={days} locale={locale} label={t("New reports, last 30 days")} empty={t("No reports in this period.")} />
        </div>
        <details className={tableToggle}>
          <summary>{t("Show as table")}</summary>
          <table className="tabular mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-rule"><th className="py-2">{t("Day")}</th><th>{t("Reports")}</th></tr>
            </thead>
            <tbody>
              {days.filter((d) => d.total > 0).map((d) => (
                <tr key={d.day} className="border-b border-rule"><td className="py-2">{d.day}</td><td>{d.total}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <section className={card} aria-labelledby="category-title">
          <h2 id="category-title" className="text-xl font-extrabold">{t("Reports by category")}</h2>
          <div className="mt-5">
            <CategoryBars rows={categoryRows} label={t("Reports by category")} />
          </div>
        </section>

        <section className={card} aria-labelledby="department-title">
          <h2 id="department-title" className="text-xl font-extrabold">{t("Department performance")}</h2>
          {departments.length === 0 ? (
            <p className="mt-4 text-sm text-pencil">{t("No reports in this period.")}</p>
          ) : (
            <div className="mt-5">
              <DepartmentBars
                label={t("Department performance")}
                legend={[
                  { label: t("Resolved"), color: "var(--color-chart-3)" },
                  { label: t("Still open"), color: "var(--color-chart-1)" },
                ]}
                rows={departments.map((d) => ({ name: d.name, total: n(d.total), resolved: n(d.resolved) }))}
              />
            </div>
          )}
          <details className={tableToggle}>
            <summary>{t("Show as table")}</summary>
            <table className="tabular mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="py-2">{t("Department")}</th>
                  <th>{t("Reports")}</th>
                  <th>{t("Resolved")}</th>
                  <th>{t("Resolution rate")}</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d, index) => (
                  <tr key={index} className="border-b border-rule">
                    <td className="py-2">{d.name}</td>
                    <td>{n(d.total)}</td>
                    <td>{n(d.resolved)}</td>
                    <td>{Math.round((n(d.resolved) / Math.max(1, n(d.total))) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      </div>

      <section className={card} aria-labelledby="checkers-title">
        <h2 id="checkers-title" className="text-xl font-extrabold">{t("Checker workload and completed checks")}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="tabular w-full text-left text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="py-3">{t("Checker")}</th>
                <th>{t("Currently assigned")}</th>
                <th>{t("Distinct reports checked")}</th>
              </tr>
            </thead>
            <tbody>
              {checkers.map((checker, index) => (
                <tr key={index} className="border-b border-rule">
                  <td className="py-3">
                    {checker.name}
                    <span className="block text-xs text-pencil">{checker.email}</span>
                  </td>
                  <td>{checker.assigned}</td>
                  <td>{checker.checked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
