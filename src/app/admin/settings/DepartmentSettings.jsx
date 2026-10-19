import { adminTranslator } from "../../../lib/admin-language";
import { saveDepartmentAction } from "../actions";
import RouteAssignments from "./RouteAssignments";
import AdminSubmit from "../AdminSubmit";
const control =
  "w-full rounded-sm border border-rule bg-card px-3 py-2.5 text-sm";
export default async function DepartmentSettings({
  departments,
  municipalities,
  routes,
}) {
  const t = await adminTranslator();
  return (
    <>
      <section
        id="departments"
        className="rounded-md border border-rule bg-card p-5 sm:p-6"
      >
        <h2 className="text-xl font-bold text-ink">
          {" "}
          {t("Departments and routing")}{" "}
        </h2>
        <p className="mt-2 text-sm text-pencil">
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
              className="grid items-end gap-3 rounded-sm bg-paper p-4 lg:grid-cols-[1fr_2fr_2fr_auto]"
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
        <RouteAssignments
          departments={departments}
          municipalities={municipalities}
          routes={routes}
        />
      </section>
    </>
  );
}
