import { database } from "../../lib/db";
import { requireAdmin } from "../../lib/admin-session";
import { categories } from "../../lib/report-options";
import {
  logoutAction,
  updateReportAction,
  saveDepartmentAction,
  saveRouteAction,
} from "./actions";
import AdminSubmit from "./AdminSubmit";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin panel | kosova.report",
  robots: { index: false, follow: false },
};
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
const control =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
const formatDate = (value) =>
  new Date(value).toLocaleString("en-GB", { timeZone: "Europe/Belgrade" });
export default async function AdminPage({ searchParams }) {
  const admin = requireAdmin();
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
    history = [],
    unavailable = false;
  try {
    const conditions = [],
      values = [];
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
        `SELECT r.id,r.public_id,r.category,c.code AS city_code,r.status,r.created_at FROM reports r JOIN cities c ON c.id=r.city_id ${where} ORDER BY r.created_at DESC,r.id DESC LIMIT 25 OFFSET ${(page - 1) * 25}`,
        values,
      ),
      db.execute(`SELECT COUNT(*) AS total FROM reports r ${where}`, values),
      db.execute(
        "SELECT status,COUNT(*) AS total FROM reports GROUP BY status",
      ),
      db.execute(
        "SELECT d.id,d.city_id,d.name,d.notification_email,c.code AS city_code FROM departments d JOIN cities c ON c.id=d.city_id ORDER BY c.name,d.name",
      ),
      db.execute(
        "SELECT COUNT(*) AS total FROM report_notifications WHERE sent_at IS NULL",
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
    if (selected) {
      const [rows] = await db.execute(
        "SELECT r.id,r.public_id,c.code AS city_code,r.category,r.status,r.description,r.lat AS latitude,r.lng AS longitude,r.created_at,r.is_anonymous AS anonymous,r.reporter_email AS contact_email,r.admin_note,d.notification_email FROM reports r JOIN departments d ON d.id=r.department_id JOIN cities c ON c.id=r.city_id WHERE r.id=? LIMIT 1",
        [selected],
      );
      report = rows[0] || null;
      if (report) {
        const detail = await Promise.all([
          db.execute(
            "SELECT id FROM report_images WHERE report_id=? ORDER BY id",
            [selected],
          ),
          db.execute(
            "SELECT actor_email,previous_status,new_status,note,created_at FROM report_audit_log WHERE report_id=? ORDER BY id DESC LIMIT 20",
            [selected],
          ),
        ]);
        photos = detail[0][0];
        history = detail[1][0];
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
  return (
    <>
      <header className="bg-[#062653] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <a href="/" className="text-xl font-bold">
              kosova.report
            </a>
            <p className="mt-1 text-xs text-blue-100">
              Administration · {admin.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a href="#departments" className="text-sm">
              Departments
            </a>
            <form action={logoutAction}>
              <button className="rounded-lg border border-white/30 px-4 py-2 text-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-7 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-[#102344]">Report inbox</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review evidence, update report progress and configure institutional
            routing.
          </p>
        </div>
        {searchParams.saved && (
          <p
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            Changes saved.
          </p>
        )}
        {searchParams.error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            Changes could not be saved. Check the database and try again.
          </p>
        )}
        {unavailable ? (
          <section
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900"
          >
            <h2 className="font-semibold">Database unavailable</h2>
            <p className="mt-2 text-sm">
              Check the MySQL environment settings and apply
              sql/004_existing_schema.sql. Do not rerun the legacy migrations.
            </p>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Object.entries(statuses).map(([key, label]) => (
                <a
                  key={key}
                  href={`/admin?status=${encodeURIComponent(key)}`}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-[#102344]">
                    {Number(
                      summary.find((row) => row.status === key)?.total || 0,
                    )}
                  </p>
                </a>
              ))}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs text-amber-800">Pending email alerts</p>
                <p className="mt-2 text-2xl font-bold text-amber-900">
                  {pending}
                </p>
              </div>
            </div>
            <form
              method="GET"
              action="/admin"
              className="flex flex-col gap-3 sm:flex-row"
            >
              <label className="flex-1">
                <span className="sr-only">Search reports</span>
                <input
                  className={control}
                  name="q"
                  defaultValue={query}
                  maxLength={100}
                  placeholder="Search public ID or description"
                />
              </label>
              <label>
                <span className="sr-only">Filter by status</span>
                <select name="status" className={control} defaultValue={status}>
                  <option value="">All statuses</option>
                  {Object.entries(statuses).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white">
                Search
              </button>
            </form>
            <div
              className={`grid items-start gap-6 ${report ? "xl:grid-cols-[1fr_1fr]" : ""}`}
            >
              <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h2 className="font-semibold">Reports</h2>
                  <span className="text-xs text-slate-500">
                    {total} matching
                  </span>
                </div>
                {!reports.length ? (
                  <p className="p-6 text-sm text-slate-500">
                    No reports match your filters.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {reports.map((row) => (
                      <li key={row.id}>
                        <a
                          href={browse(page, row.id)}
                          className={`block p-4 hover:bg-blue-50 ${selected === String(row.id) ? "bg-blue-50" : ""}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-blue-900">
                              {row.public_id}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                              {statuses[row.status] || row.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm">
                            {labels[row.category] || row.category} ·{" "}
                            {municipalities.find(
                              (item) => item.code === row.city_code,
                            )?.name || row.city_code}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(row.created_at)}
                          </p>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm">
                  {page > 1 ? (
                    <a
                      className="font-semibold text-blue-800"
                      href={browse(page - 1)}
                    >
                      Previous
                    </a>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-slate-500">Page {page}</span>
                  {page * 25 < total ? (
                    <a
                      className="font-semibold text-blue-800"
                      href={browse(page + 1)}
                    >
                      Next
                    </a>
                  ) : (
                    <span />
                  )}
                </div>
              </section>
              {report && (
                <section className="min-w-0 space-y-5 rounded-xl border border-slate-200 bg-white p-5">
                  <div>
                    <h2 className="text-xl font-bold text-[#102344]">
                      {report.public_id}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted {formatDate(report.created_at)}
                    </p>
                  </div>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="font-semibold text-slate-500">
                        Description
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words">
                        {report.description}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Reporter</dt>
                      <dd className="mt-1 break-words">
                        {report.anonymous ? "Anonymous" : report.contact_email}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">
                        Department notification
                      </dt>
                      <dd className="mt-1 break-words">
                        {report.notification_email}
                      </dd>
                    </div>
                  </dl>
                  <a
                    className="inline-flex items-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-800"
                    href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=17/${report.latitude}/${report.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View location · {report.latitude}, {report.longitude}
                  </a>
                  {photos.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">
                        Evidence · {photos.length}
                      </h3>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {photos.map((photo) => (
                          <a
                            key={photo.id}
                            href={`/api/admin/images/${photo.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={`/api/admin/images/${photo.id}`}
                              alt="Report evidence"
                              loading="lazy"
                              className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <form
                    action={updateReportAction}
                    className="space-y-4 border-t border-slate-100 pt-5"
                  >
                    <input type="hidden" name="id" value={report.id} />
                    <label className="block text-sm font-semibold">
                      Status
                      <select
                        className={`${control} mt-2`}
                        name="status"
                        defaultValue={report.status}
                      >
                        {Object.entries(statuses).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold">
                      Internal note
                      <textarea
                        name="note"
                        rows={4}
                        maxLength={5000}
                        defaultValue={report.admin_note || ""}
                        className={`${control} mt-2`}
                      />
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        For authorized staff. Every save is recorded in report
                        history.
                      </span>
                    </label>
                    <AdminSubmit>Save report</AdminSubmit>
                  </form>
                  {history.length > 0 && (
                    <div className="border-t border-slate-100 pt-5">
                      <h3 className="text-sm font-semibold">Recent history</h3>
                      <ul className="mt-3 space-y-3">
                        {history.map((item, index) => (
                          <li
                            key={index}
                            className="rounded-lg bg-slate-50 p-3 text-xs"
                          >
                            <p className="font-semibold">
                              {statuses[item.previous_status]} →{" "}
                              {statuses[item.new_status]}
                            </p>
                            <p className="mt-1 break-words text-slate-500">
                              {item.actor_email} · {formatDate(item.created_at)}
                            </p>
                            {item.note && (
                              <p className="mt-2 whitespace-pre-wrap break-words">
                                {item.note}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}
            </div>
            {selected && !report && (
              <p role="status" className="text-sm text-slate-500">
                The selected report could not be found.
              </p>
            )}

            <section
              id="departments"
              className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
            >
              <h2 className="text-xl font-bold text-[#102344]">
                Departments and routing
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Keep institutional contact details here. Assign each category to
                a department in the same municipality below.
              </p>
              <div className="mt-5 space-y-3">
                {departments.map((department) => (
                  <form
                    key={department.id}
                    action={saveDepartmentAction}
                    className="grid items-end gap-3 rounded-lg bg-slate-50 p-4 lg:grid-cols-[1fr_2fr_2fr_auto]"
                  >
                    <input type="hidden" name="id" value={department.id} />
                    <input
                      type="hidden"
                      name="city_id"
                      value={department.city_id}
                    />
                    <p className="py-2 text-sm font-semibold">
                      {municipalities.find(
                        (city) => city.id === department.city_id,
                      )?.name || department.city_code}
                    </p>
                    <label className="text-xs font-semibold">
                      Department name
                      <input
                        name="name"
                        required
                        maxLength={255}
                        className={`${control} mt-1`}
                        defaultValue={department.name}
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      Notification email
                      <input
                        name="email"
                        type="email"
                        required
                        maxLength={255}
                        className={`${control} mt-1`}
                        defaultValue={department.notification_email}
                      />
                    </label>
                    <AdminSubmit>Save</AdminSubmit>
                  </form>
                ))}
              </div>
              <h3 className="mt-6 font-semibold">Add a department</h3>
              <form
                action={saveDepartmentAction}
                className="mt-3 grid items-end gap-3 md:grid-cols-4"
              >
                <input type="hidden" name="id" value="" />
                <label className="text-xs font-semibold">
                  Municipality
                  <select name="city_id" required className={`${control} mt-1`}>
                    {municipalities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Department name
                  <input
                    name="name"
                    required
                    maxLength={255}
                    className={`${control} mt-1`}
                  />
                </label>
                <label className="text-xs font-semibold">
                  Notification email
                  <input
                    name="email"
                    required
                    type="email"
                    maxLength={255}
                    className={`${control} mt-1`}
                  />
                </label>
                <AdminSubmit>Add department</AdminSubmit>
              </form>
              <h3 className="mt-8 font-semibold">Category assignments</h3>
              {!routes.length && (
                <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  No categories are routed yet. Add assignments to enable public
                  reporting.
                </p>
              )}
              <div className="mt-4 space-y-3">
                {routes.map((route) => (
                  <form
                    key={`${route.city_id}-${route.category}`}
                    action={saveRouteAction}
                    className="grid items-end gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-[1fr_2fr_auto_auto]"
                  >
                    <input type="hidden" name="city_id" value={route.city_id} />
                    <input
                      type="hidden"
                      name="category"
                      value={route.category}
                    />
                    <p className="py-2 text-xs font-semibold">
                      {municipalities.find((city) => city.id === route.city_id)
                        ?.name || route.city_code}{" "}
                      · {labels[route.category] || route.category}
                    </p>
                    <label className="text-xs font-semibold">
                      Department
                      <select
                        name="department_id"
                        required
                        defaultValue={route.department_id}
                        className={`${control} mt-1`}
                      >
                        {departments
                          .filter(
                            (department) =>
                              department.city_id === route.city_id,
                          )
                          .map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={Boolean(route.active)}
                      />
                      Active
                    </label>
                    <AdminSubmit>Save route</AdminSubmit>
                  </form>
                ))}
              </div>
              <h3 className="mt-6 font-semibold">
                Add or update category assignment
              </h3>
              <form
                action={saveRouteAction}
                className="mt-3 grid items-end gap-3 md:grid-cols-2 lg:grid-cols-5"
              >
                <label className="text-xs font-semibold">
                  Municipality
                  <select name="city_id" required className={`${control} mt-1`}>
                    {municipalities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Category
                  <select
                    name="category"
                    required
                    className={`${control} mt-1`}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {labels[category]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Department (same municipality)
                  <select
                    name="department_id"
                    required
                    className={`${control} mt-1`}
                  >
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.city_code} · {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-xs">
                  <input type="checkbox" name="active" defaultChecked />
                  Active
                </label>
                <AdminSubmit>Save assignment</AdminSubmit>
              </form>
            </section>
          </>
        )}
      </div>
    </>
  );
}
