"use client";

import { useAdminText } from "./AdminLanguage";
import { useFormStatus } from "react-dom";
import { btn } from "../../components/ui";
export default function AdminSubmit({ children, className = "" }) {
  const t = useAdminText();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${btn.primary} min-h-11 px-4 text-sm ${className}`}
    >
      {pending ? t("Saving…") : children}
    </button>
  );
}
