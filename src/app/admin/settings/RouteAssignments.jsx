"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { useAdminText } from "../AdminLanguage";
import AdminSubmit from "../AdminSubmit";
import { deleteRouteAction, saveRouteAction } from "../actions";
import { categories } from "../../../lib/report-options";
const control =
  "w-full rounded-sm border border-rule bg-card px-3 py-2.5 text-sm";
const label = (category) => category.replaceAll("_", " ");
export default function RouteAssignments({
  departments,
  municipalities,
  routes,
}) {
  const t = useAdminText();
  const formRef = useRef(null);
  const departmentRef = useRef(null);
  const findRoute = (cityId, category) =>
    routes.find(
      (route) =>
        String(route.city_id) === cityId && route.category === category,
    );
  const departmentsIn = (cityId) =>
    departments.filter((department) => String(department.city_id) === cityId);
  // Loads the saved rule for a municipality/category pair, or sensible defaults.
  function formFor(cityId, category) {
    const existing = findRoute(cityId, category);
    const options = departmentsIn(cityId);
    const saved =
      existing &&
      options.find(
        (department) =>
          String(department.id) === String(existing.department_id),
      );
    return {
      cityId,
      category,
      departmentId: String(saved?.id ?? options[0]?.id ?? ""),
      active: existing ? Number(existing.active) === 1 : true,
    };
  }
  const [form, setForm] = useState(() =>
    formFor(String(municipalities[0]?.id ?? ""), categories[0]),
  );
  const [confirming, setConfirming] = useState(null);
  const [saveState, save] = useFormState(saveRouteAction, {});
  const [deleteState, remove] = useFormState(deleteRouteAction, {});
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    const latest = [saveState, deleteState]
      .filter((state) => state.at)
      .sort((a, b) => b.at - a.at)[0];
    if (!latest) return;
    setNotice(latest);
    setConfirming(null);
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [saveState, deleteState]);
  const options = departmentsIn(form.cityId);
  const editing = Boolean(findRoute(form.cityId, form.category));
  const cityName = (id) =>
    municipalities.find((city) => String(city.id) === String(id))?.name;
  function edit(route) {
    setForm(formFor(String(route.city_id), route.category));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    departmentRef.current?.focus({ preventScroll: true });
  }
  return (
    <>
      {notice && (
        <p
          role={notice.error ? "alert" : "status"}
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-sm p-4 text-sm font-semibold shadow-lift ${notice.error ? "bg-error text-on-blue" : "bg-ok text-on-blue"}`}
        >
          {t(notice.error || notice.saved)}
        </p>
      )}
      <h3 className="mt-8 font-semibold">{t("Category assignments")}</h3>
      {!routes.length ? (
        <p className="mt-2 rounded-sm bg-wash p-3 text-sm text-stamp">
          {t(
            "No categories are routed yet. Add assignments to enable public reporting.",
          )}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-sm border border-rule">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-paper text-xs uppercase text-pencil">
              <tr>
                <th className="px-4 py-3">{t("Municipality")}</th>
                <th className="px-4 py-3">{t("Category")}</th>
                <th className="px-4 py-3">{t("Department")}</th>
                <th className="px-4 py-3">{t("Status")}</th>
                <th className="px-4 py-3 text-right">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wash">
              {routes.map((route) => {
                const key = `${route.city_id}-${route.category}`;
                const department = departments.find(
                  (item) =>
                    String(item.id) === String(route.department_id) &&
                    String(item.city_id) === String(route.city_id),
                );
                const active = Number(route.active) === 1 && department;
                return (
                  <tr key={key} className={active ? "" : "text-pencil"}>
                    <td className="px-4 py-3 font-semibold">
                      {cityName(route.city_id) || route.city_code}
                    </td>
                    <td className="px-4 py-3">{t(label(route.category))}</td>
                    <td className="px-4 py-3">
                      {department?.name || "—"}
                      {department && (
                        <span className="block text-xs text-pencil">
                          {department.notification_email}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-ok-wash text-ok" : "bg-wash text-pencil"}`}
                      >
                        {active ? t("Active") : t("Inactive")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {confirming === key ? (
                        <form
                          action={remove}
                          className="flex items-center justify-end gap-2"
                        >
                          <input
                            type="hidden"
                            name="city_id"
                            value={route.city_id}
                          />
                          <input
                            type="hidden"
                            name="category"
                            value={route.category}
                          />
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            className="min-h-11 rounded-sm px-3 text-sm font-semibold text-ink hover:bg-wash"
                          >
                            {t("Cancel")}
                          </button>
                          <AdminSubmit className="bg-error">
                            {t("Confirm delete")}
                          </AdminSubmit>
                        </form>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => edit(route)}
                            className="min-h-11 rounded-sm border border-rule px-3 text-sm font-semibold text-ink hover:bg-wash"
                          >
                            {t("Edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(key)}
                            className="min-h-11 rounded-sm border border-error px-3 text-sm font-semibold text-error hover:bg-error-wash"
                          >
                            {t("Delete")}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <h3 className="mt-6 font-semibold">
        {t("Add or update category assignment")}
      </h3>
      {editing && (
        <p className="mt-2 text-sm text-ink">
          {t(
            "This municipality and category already have an assignment. Saving will update it.",
          )}
        </p>
      )}
      <form
        ref={formRef}
        action={save}
        className="mt-3 grid items-end gap-3 md:grid-cols-2 lg:grid-cols-5"
      >
        <label className="text-xs font-semibold">
          {t("Municipality")}
          <select
            name="city_id"
            required
            value={form.cityId}
            onChange={(event) =>
              setForm(formFor(event.target.value, form.category))
            }
            className={`${control} mt-1`}
          >
            {municipalities.map((city) => (
              <option key={city.id} value={String(city.id)}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold">
          {t("Category")}
          <select
            name="category"
            required
            value={form.category}
            onChange={(event) =>
              setForm(formFor(form.cityId, event.target.value))
            }
            className={`${control} mt-1`}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {t(label(category))}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold">
          {t("Department (same municipality)")}
          <select
            ref={departmentRef}
            name="department_id"
            required
            value={form.departmentId}
            onChange={(event) =>
              setForm({ ...form, departmentId: event.target.value })
            }
            className={`${control} mt-1`}
          >
            {options.map((department) => (
              <option key={department.id} value={String(department.id)}>
                {department.name}
              </option>
            ))}
          </select>
          {!options.length && (
            <span className="mt-1 block font-normal text-stamp">
              {t(
                "No departments in this municipality yet. Add one above first.",
              )}
            </span>
          )}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="active"
            checked={form.active}
            onChange={(event) =>
              setForm({ ...form, active: event.target.checked })
            }
          />
          {t("Active")}
        </label>
        <AdminSubmit>{t("Save assignment")}</AdminSubmit>
      </form>
    </>
  );
}
