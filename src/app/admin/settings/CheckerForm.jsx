"use client";

import { useActionState } from "react";
import { useAdminText } from "../AdminLanguage";
import { createCheckerAction, resetCheckerAction } from "../actions";
import AdminSubmit from "../AdminSubmit";
import { field } from "../../../components/ui";

// Creates a staff account (checker or admin), or with `id` issues a checker a new one-time password.
export default function CheckerForm({ id }) {
  const t = useAdminText();
  const [state, action] = useActionState(id ? resetCheckerAction : createCheckerAction, {});
  return (
    <form action={action} className="grid gap-3">
      {id ? (
        <input name="id" type="hidden" value={id} />
      ) : (
        <>
          <label className="text-sm font-bold">
            {t("Name")}
            <input name="name" required maxLength={120} className={`${field.input} mt-1 min-h-11 py-2`} />
          </label>
          <label className="text-sm font-bold">
            {t("Email")}
            <input name="email" type="email" required maxLength={254} className={`${field.input} mt-1 min-h-11 py-2`} />
          </label>
          <fieldset>
            <legend className="text-sm font-bold">{t("Role")}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ["checker", t("Checker"), t("Views and verifies assigned reports.")],
                ["owner", t("Admin"), t("Full access, including settings and accounts.")],
              ].map(([value, label, hint]) => (
                <label key={value} className="flex cursor-pointer gap-2 rounded-sm border-[1.5px] border-rule bg-card p-3 has-checked:border-blue has-checked:bg-wash has-focus-visible:outline-3 has-focus-visible:outline-blue">
                  <input type="radio" name="role" value={value} defaultChecked={value === "checker"} className="mt-0.5 size-5 shrink-0 accent-[var(--color-blue)]" />
                  <span>
                    <span className="block font-bold">{label}</span>
                    <span className="block text-xs text-pencil">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-error">
          {t(state.error)}
        </p>
      )}
      {state.password && (
        <div role="status" className="rounded-sm bg-wash p-3 text-sm">
          <p>{t("Copy this one-time password now. It expires in 24 hours and must be changed at first sign-in.")}</p>
          {state.email && <p className="mt-2 font-semibold">{state.email}</p>}
          <code className="tabular mt-2 block font-bold break-all">{state.password}</code>
        </div>
      )}
      <div>
        <AdminSubmit>{id ? t("Generate new one-time password") : t("Create account")}</AdminSubmit>
      </div>
    </form>
  );
}
