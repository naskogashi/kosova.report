"use client";

import { useAdminText } from "../AdminLanguage";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "../actions";
function Submit() {
  const t = useAdminText();
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="min-h-12 w-full rounded-sm bg-blue px-5 py-3 font-semibold text-on-blue disabled:opacity-50"
    >
      {pending ? t("Signing in\u2026") : t("Sign in")}
    </button>
  );
}
export default function LoginForm() {
  const t = useAdminText();
  const [state, action] = useFormState(loginAction, {});
  return (
    <form action={action} className="mt-6 space-y-5">
      <label className="block text-sm font-semibold">
        {" "}
        {t("Email")}{" "}
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="username"
          className="mt-2 w-full rounded-sm border border-rule p-3"
        />
      </label>
      <label className="block text-sm font-semibold">
        {" "}
        {t("Password")}{" "}
        <input
          name="password"
          type="password"
          required
          maxLength={1024}
          autoComplete="current-password"
          className="mt-2 w-full rounded-sm border border-rule p-3"
        />
      </label>
      {state.error && (
        <p
          role="alert"
          className="rounded-sm bg-error-wash p-3 text-sm text-error"
        >
          {t(state.error)}
        </p>
      )}
      <Submit />
    </form>
  );
}
