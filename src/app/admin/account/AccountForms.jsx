"use client";

import { useActionState } from "react";
import { useAdminText } from "../AdminLanguage";
import { changePasswordAction, updateProfileAction } from "../actions";
import AdminSubmit from "../AdminSubmit";
import { field } from "../../../components/ui";

const input = `${field.input} mt-1 min-h-12 py-2.5`;

function Message({ state }) {
  const t = useAdminText();
  if (!state?.at) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={`rounded-sm p-3 text-sm font-semibold ${state.error ? "bg-error-wash text-error" : "bg-ok-wash text-ok"}`}>
      {t(state.error || state.saved)}
    </p>
  );
}

// Two separate forms: details (name, email) and password. Each confirms with the current password.
export default function AccountForms({ account }) {
  const t = useAdminText();
  const [profile, saveProfile] = useActionState(updateProfileAction, {});
  const [password, savePassword] = useActionState(changePasswordAction, {});
  const card = "grid gap-4 rounded-lg bg-card p-6 shadow-[0_0_0_1px_var(--color-rule)]";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={saveProfile} className={card} aria-labelledby="profile-title">
        <h2 id="profile-title" className="text-xl font-extrabold">{t("Your details")}</h2>
        <label className="text-sm font-bold">
          {t("Name")}
          <input name="name" required maxLength={120} defaultValue={account.name} autoComplete="name" className={input} />
        </label>
        <label className="text-sm font-bold">
          {t("Email")}
          <input name="email" type="email" required maxLength={254} defaultValue={account.email} autoComplete="email" className={input} />
        </label>
        <label className="text-sm font-bold">
          {t("Current password")}
          <input name="current_password" type="password" required autoComplete="current-password" className={input} />
        </label>
        <Message state={profile} />
        <div>
          <AdminSubmit>{t("Save details")}</AdminSubmit>
        </div>
      </form>
      <form action={savePassword} className={card} aria-labelledby="password-title">
        <h2 id="password-title" className="text-xl font-extrabold">{t("Change password")}</h2>
        <label className="text-sm font-bold">
          {t("Current password")}
          <input name="current_password" type="password" required autoComplete="current-password" className={input} />
        </label>
        <label className="text-sm font-bold">
          {t("New password")}
          <input name="new_password" type="password" required minLength={14} maxLength={1024} autoComplete="new-password" className={input} />
        </label>
        <label className="text-sm font-bold">
          {t("Confirm new password")}
          <input name="confirm_password" type="password" required minLength={14} maxLength={1024} autoComplete="new-password" className={input} />
        </label>
        <p className="text-sm text-pencil">{t("Use at least 14 characters. Saving signs out all other sessions.")}</p>
        <Message state={password} />
        <div>
          <AdminSubmit>{t("Change password")}</AdminSubmit>
        </div>
      </form>
    </div>
  );
}
