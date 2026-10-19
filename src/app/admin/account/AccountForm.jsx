"use client";
import { useFormState } from "react-dom";
import { updateAccountAction } from "../actions";
import AdminSubmit from "../AdminSubmit";
export default function AccountForm({ account }) {
  const [state, action] = useFormState(updateAccountAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      {[
        ["name", "Name", "text", account.name],
        ["email", "Email", "email", account.email],
      ].map(([name, label, type, value]) => (
        <label key={name} className="block text-sm font-semibold">
          {label}
          <input
            name={name}
            type={type}
            required
            defaultValue={value}
            maxLength={name === "name" ? 120 : 254}
            className="mt-2 w-full rounded-lg border p-3"
          />
        </label>
      ))}
      {!account.must_change_password && (
        <label className="block text-sm font-semibold">
          Current password
          <input
            name="current_password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-lg border p-3"
          />
        </label>
      )}
      {[
        ["new_password", "New password"],
        ["confirm_password", "Confirm new password"],
      ].map(([name, label]) => (
        <label key={name} className="block text-sm font-semibold">
          {label}
          <input
            name={name}
            type="password"
            minLength={14}
            maxLength={1024}
            required
            autoComplete="new-password"
            className="mt-2 w-full rounded-lg border p-3"
          />
        </label>
      ))}
      <p className="text-xs text-slate-500">
        Use at least 14 characters. Saving signs out all other sessions.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <AdminSubmit>Save account details</AdminSubmit>
    </form>
  );
}
