"use client";
import { useFormState } from "react-dom";
import { createCheckerAction, resetCheckerAction } from "../actions";
import AdminSubmit from "../AdminSubmit";
export default function CheckerForm({ id }) {
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
            Name
            <input
              name="name"
              required
              maxLength={120}
              className="mt-1 w-full rounded-lg border p-3"
            />
          </label>
          <label className="block text-xs font-semibold">
            Email
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className="mt-1 w-full rounded-lg border p-3"
            />
          </label>
        </>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.password && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
        >
          <p>
            Copy this one-time password now. It expires in 24 hours and must be
            changed at first sign-in.
          </p>
          {state.email && <p className="mt-2">{state.email}</p>}
          <code className="mt-2 block break-all font-bold">
            {state.password}
          </code>
        </div>
      )}
      <AdminSubmit>
        {id ? "Generate new one-time password" : "Create report checker"}
      </AdminSubmit>
    </form>
  );
}
