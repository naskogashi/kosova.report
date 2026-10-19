import { adminText as t } from "../../../lib/admin-language";
import { saveDepartmentAction, saveRouteAction } from "../actions";
import AdminSubmit from "../AdminSubmit";
import { categories } from "../../../lib/report-options";
const control =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
const labels = Object.fromEntries(
  categories.map((category) => [category, category.replaceAll("_", " ")]),
);
export default function DepartmentSettings({
  departments,
  municipalities,
  routes,
}) {
  return (
    <>
      <section
        id="departments"
        className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <h2 className="text-xl font-bold text-[#102344]">
          {" "}
          {t("Departments and routing")}{" "}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {" "}
          {t(
            "Keep institutional contact details here. Assign each category to a department in the same municipality below.",
          )}{" "}
        </p>
        <div className="mt-5 space-y-3">
          {departments.map((department) => (
            <form
              key={department.id}
              action={saveDepartmentAction}
              className="grid items-end gap-3 rounded-lg bg-slate-50 p-4 lg:grid-cols-[1fr_2fr_2fr_auto]"
            >
              <input type="hidden" name="id" value={department.id} />
              <input type="hidden" name="city_id" value={department.city_id} />
              <p className="py-2 text-sm font-semibold">
                {municipalities.find((city) => city.id === department.city_id)
                  ?.name || department.city_code}
              </p>
              <label className="text-xs font-semibold">
                {" "}
                {t("Department name")}{" "}
                <input
                  name="name"
                  required
                  maxLength={255}
                  className={`${control} mt-1`}
                  defaultValue={department.name}
                />
              </label>
              <label className="text-xs font-semibold">
                {" "}
                {t("Notification email")}{" "}
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={255}
                  className={`${control} mt-1`}
                  defaultValue={department.notification_email}
                />
              </label>
              <AdminSubmit>{t("Save")}</AdminSubmit>
            </form>
          ))}
        </div>
        <h3 className="mt-6 font-semibold">{t("Add a department")}</h3>
        <form
          action={saveDepartmentAction}
          className="mt-3 grid items-end gap-3 md:grid-cols-4"
        >
          <input type="hidden" name="id" value="" />
          <label className="text-xs font-semibold">
            {" "}
            {t("Municipality")}{" "}
            <select name="city_id" required className={`${control} mt-1`}>
              {municipalities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            {" "}
            {t("Department name")}{" "}
            <input
              name="name"
              required
              maxLength={255}
              className={`${control} mt-1`}
            />
          </label>
          <label className="text-xs font-semibold">
            {" "}
            {t("Notification email")}{" "}
            <input
              name="email"
              required
              type="email"
              maxLength={255}
              className={`${control} mt-1`}
            />
          </label>
          <AdminSubmit>{t("Add department")}</AdminSubmit>
        </form>
        <h3 className="mt-8 font-semibold">{t("Category assignments")}</h3>
        {!routes.length && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {" "}
            {t(
              "No categories are routed yet. Add assignments to enable public reporting.",
            )}{" "}
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
              <input type="hidden" name="category" value={route.category} />
              <p className="py-2 text-xs font-semibold">
                {municipalities.find((city) => city.id === route.city_id)
                  ?.name || route.city_code}{" "}
                · {t(labels[route.category] || route.category)}
              </p>
              <label className="text-xs font-semibold">
                {" "}
                {t("Department")}{" "}
                <select
                  name="department_id"
                  required
                  defaultValue={route.department_id}
                  className={`${control} mt-1`}
                >
                  {departments
                    .filter(
                      (department) => department.city_id === route.city_id,
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
                />{" "}
                {t("Active")}{" "}
              </label>
              <AdminSubmit>{t("Save route")}</AdminSubmit>
            </form>
          ))}
        </div>
        <h3 className="mt-6 font-semibold">
          {" "}
          {t("Add or update category assignment")}{" "}
        </h3>
        <form
          action={saveRouteAction}
          className="mt-3 grid items-end gap-3 md:grid-cols-2 lg:grid-cols-5"
        >
          <label className="text-xs font-semibold">
            {" "}
            {t("Municipality")}{" "}
            <select name="city_id" required className={`${control} mt-1`}>
              {municipalities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            {" "}
            {t("Category")}{" "}
            <select name="category" required className={`${control} mt-1`}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(labels[category])}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            {" "}
            {t("Department (same municipality)")}{" "}
            <select name="department_id" required className={`${control} mt-1`}>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.city_code} · {department.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input type="checkbox" name="active" defaultChecked />{" "}
            {t("Active")}{" "}
          </label>
          <AdminSubmit>{t("Save assignment")}</AdminSubmit>
        </form>
      </section>
    </>
  );
}
