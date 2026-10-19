"use client";

import { useAdminText } from "../AdminLanguage";
import { useFormState } from "react-dom";
import { createCheckerAction, resetCheckerAction } from "../actions";
import AdminSubmit from "../AdminSubmit";
export default function CheckerForm({ id }) {
  const t = useAdminText();
  const [state, action] = useFormState(
    id ? resetCheckerAction : createCheckerAction,
    {},
  );
  return (
    <form action={action} className="space-y-3">
      {id ? (
        <input name="id" type="hidden" value={id} />
      ) : (
        <>
          <label className="block text-xs font-semibold">
            {" "}
            {t("Name")}{" "}
            <input
              name="name"
              required
              maxLength={120}
              className="mt-1 w-full rounded-sm border p-3"
            />
          </label>
          <label className="block text-xs font-semibold">
            {" "}
            {t("Email")}{" "}
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className="mt-1 w-full rounded-sm border p-3"
            />
          </label>
        </>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-error">
          {t(state.error)}
        </p>
      )}
      {state.password && (
        <div
          role="status"
          className="rounded-sm border border-rule bg-wash p-3 text-sm"
        >
          <p>
            {" "}
            {t(
              "Copy this one-time password now. It expires in 24 hours and must be changed at first sign-in.",
            )}{" "}
          </p>
          {state.email && <p className="mt-2">{state.email}</p>}
          <code className="mt-2 block break-all font-bold">
            {state.password}
          </code>
        </div>
      )}
      <AdminSubmit>
        {id ? t("Generate new one-time password") : t("Create report checker")}
      </AdminSubmit>
    </form>
  );
}
