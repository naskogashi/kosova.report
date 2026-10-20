"use client";

import { useActionState, useEffect, useState } from "react";
import { useAdminText } from "../AdminLanguage";
import AdminSubmit from "../AdminSubmit";
import { deleteRouteAction, saveDepartmentInlineAction, saveRouteAction } from "../actions";
import { categories } from "../../../lib/report-options";
import { Icon, categoryStyle } from "../../../components/icons";
import { field } from "../../../components/ui";

const names = {
  infrastructure: "Infrastructure",
  environment: "Environment",
  public_services: "Public services",
  administration: "Administration",
  health: "Health",
  education: "Education",
  safety: "Safety",
};
const input = `${field.input} mt-1 min-h-11 py-2`;

// Saved / failed message under a form. Shows the database's reason to the owner when there is one.
function Result({ state }) {
  const t = useAdminText();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!state?.at) return;
    setVisible(true);
    if (!state.error) {
      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [state?.at]);
  if (!visible || !state?.at) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={`text-sm font-semibold ${state.error ? "text-error" : "text-ok"}`}>
      {t(state.error || state.saved)}
      {state.detail && <span className="mt-1 block font-normal break-words text-pencil">{state.detail}</span>}
    </p>
  );
}

function DepartmentRow({ cityId, department }) {
  const t = useAdminText();
  const [state, action] = useActionState(saveDepartmentInlineAction, {});
  return (
    <form action={action} className="grid gap-2 rounded-md bg-paper p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
      {department && <input type="hidden" name="id" value={department.id} />}
      <input type="hidden" name="city_id" value={cityId} />
      <label className="text-sm font-bold">
        {t("Department name")}
        <input name="name" required maxLength={255} defaultValue={department?.name || ""} className={input} placeholder={department ? undefined : t("For example: Directorate of Public Services")} />
      </label>
      <label className="text-sm font-bold">
        {t("Notification email")}
        <input name="email" type="email" required maxLength={255} defaultValue={department?.notification_email || ""} className={`${input} tabular`} autoComplete="off" />
      </label>
      <AdminSubmit>{department ? t("Save") : t("Add department")}</AdminSubmit>
      <div className="md:col-span-3">
        <Result state={state} />
      </div>
    </form>
  );
}

function CategoryRow({ cityId, category, departments, route }) {
  const t = useAdminText();
  const [state, action] = useActionState(saveRouteAction, {});
  const [, remove] = useActionState(deleteRouteAction, {});
  const saved = route && departments.find((d) => String(d.id) === String(route.department_id));
  const [choice, setChoice] = useState(saved ? String(saved.id) : departments[0] ? String(departments[0].id) : "new");
  useEffect(() => {
    if (!departments.some((d) => String(d.id) === choice) && choice !== "new")
      setChoice(departments[0] ? String(departments[0].id) : "new");
  }, [departments.length]);
  const style = categoryStyle[category];
  const active = route && Number(route.active) === 1 && saved;
  return (
    <li className="rounded-md bg-paper p-3">
      <form action={action} className="grid gap-3 lg:grid-cols-[13rem_1fr_auto_auto] lg:items-end">
        <input type="hidden" name="city_id" value={cityId} />
        <input type="hidden" name="category" value={category} />
        <div className="flex items-center gap-3 lg:pb-2">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-sm ${style.text} ${style.tint}`}>
            <Icon name={category} className="size-6" />
          </span>
          <span>
            <span className="block font-extrabold">{t(names[category])}</span>
            <span className={`text-xs font-bold ${active ? "text-ok" : "text-pencil"}`}>{active ? t("Active") : route ? t("Inactive") : t("Not set")}</span>
          </span>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-bold">
            {t("Department")}
            <select name="department_id" value={choice} onChange={(event) => setChoice(event.target.value)} className={input}>
              {departments.map((department) => (
                <option key={department.id} value={String(department.id)}>
                  {department.name} ({department.notification_email})
                </option>
              ))}
              <option value="new">{t("New department…")}</option>
            </select>
          </label>
          {choice === "new" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-bold">
                {t("Department name")}
                <input name="new_name" required maxLength={255} className={input} />
              </label>
              <label className="text-sm font-bold">
                {t("Notification email")}
                <input name="new_email" type="email" required maxLength={255} className={`${input} tabular`} autoComplete="off" />
              </label>
            </div>
          )}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="active" defaultChecked={route ? Number(route.active) === 1 : true} className="size-5 accent-[var(--color-blue)]" />
          {t("Active")}
        </label>
        <AdminSubmit>{t("Save")}</AdminSubmit>
        <div className="lg:col-span-4">
          <Result state={state} />
        </div>
      </form>
      {route && (
        <form action={remove} className="mt-1 flex justify-end">
          <input type="hidden" name="city_id" value={cityId} />
          <input type="hidden" name="category" value={category} />
          <button type="submit" className="min-h-10 rounded-sm px-2 text-sm font-bold text-error hover:bg-error-wash">
            {t("Remove assignment")}
          </button>
        </form>
      )}
    </li>
  );
}

// Per municipality: its departments (name + email) and where each category goes.
export default function DepartmentRouting({ municipalities, departments, routes }) {
  const t = useAdminText();
  return (
    <section id="departments" className="grid gap-6 rounded-lg bg-card p-5 shadow-[0_0_0_1px_var(--color-rule)] sm:p-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-[-0.02em]">{t("Departments and routing")}</h2>
        <p className="mt-1 max-w-[46rem] text-pencil">
          {t("Every department has its own email. Each category sends its reports to one department of the same municipality.")}
        </p>
      </div>
      {municipalities.map((city) => {
        const own = departments.filter((d) => String(d.city_id) === String(city.id));
        const cityRoutes = routes.filter((r) => String(r.city_id) === String(city.id));
        return (
          <article key={city.id} className="grid gap-5 border-t border-rule pt-5">
            <h3 className="text-xl font-extrabold">{city.name}</h3>
            <div className="grid gap-2">
              <h4 className="font-bold">{t("Departments")}</h4>
              {own.length === 0 && <p className="text-sm text-pencil">{t("No departments yet. Add the first one here, or create one from a category below.")}</p>}
              {own.map((department) => (
                <DepartmentRow key={department.id} cityId={city.id} department={department} />
              ))}
              <DepartmentRow key={`new-${own.length}`} cityId={city.id} />
            </div>
            <div className="grid gap-2">
              <h4 className="font-bold">{t("Where each category goes")}</h4>
              <ul className="grid gap-2">
                {categories.map((category) => (
                  <CategoryRow
                    key={`${category}-${own.length}`}
                    cityId={city.id}
                    category={category}
                    departments={own}
                    route={cityRoutes.find((r) => r.category === category)}
                  />
                ))}
              </ul>
            </div>
          </article>
        );
      })}
    </section>
  );
}
