"use client";

import { useAdminText } from "../AdminLanguage";
import { useActionState } from "react";
import { updateAccountAction } from "../actions";
import AdminSubmit from "../AdminSubmit";
export default function AccountForm({ account }) {
  const t = useAdminText();
  const [state, action] = useActionState(updateAccountAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      {[
        ["name", t("Name"), "text", account.name],
        ["email", t("Email"), "email", account.email],
      ].map(([name, label, type, value]) => (
        <label key={name} className="block text-sm font-semibold">
          {t(label)}
          <input
            name={name}
            type={type}
            required
            defaultValue={value}
            maxLength={name === "name" ? 120 : 254}
            className="mt-2 w-full rounded-sm border p-3"
          />
        </label>
      ))}
      {!account.must_change_password && (
        <label className="block text-sm font-semibold">
          {" "}
          {t("Current password")}{" "}
          <input
            name="current_password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-sm border p-3"
          />
        </label>
      )}
      {[
        ["new_password", t("New password")],
        ["confirm_password", t("Confirm new password")],
      ].map(([name, label]) => (
        <label key={name} className="block text-sm font-semibold">
          {t(label)}
          <input
            name={name}
            type="password"
            minLength={14}
            maxLength={1024}
            required
            autoComplete="new-password"
            className="mt-2 w-full rounded-sm border p-3"
          />
        </label>
      ))}
      <p className="text-xs text-pencil">
        {" "}
        {t(
          "Use at least 14 characters. Saving signs out all other sessions.",
        )}{" "}
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-error">
          {t(state.error)}
        </p>
      )}
      <AdminSubmit>{t("Save account details")}</AdminSubmit>
    </form>
  );
}
