"use client";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "../actions";
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="min-h-12 w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
export default function LoginForm() {
  const [state, action] = useFormState(loginAction, {});
  return (
    <form action={action} className="mt-6 space-y-5">
      <label className="block text-sm font-semibold">
        Email
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="username"
          className="mt-2 w-full rounded-lg border border-slate-300 p-3"
        />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <input
          name="password"
          type="password"
          required
          maxLength={1024}
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border border-slate-300 p-3"
        />
      </label>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      <Submit />
    </form>
  );
}
