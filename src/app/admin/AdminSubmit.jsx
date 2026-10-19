"use client";

import { useAdminText } from "./AdminLanguage";
import { useFormStatus } from "react-dom";
export default function AdminSubmit({ children, className = "" }) {
  const t = useAdminText();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${className}`}
    >
      {pending ? t("Saving\u2026") : children}
    </button>
  );
}
