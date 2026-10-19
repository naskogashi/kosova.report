import { redirect } from "next/navigation";
import { adminConfig } from "../../../lib/admin-auth";
import { currentAdmin } from "../../../lib/admin-session";
import LoginForm from "./LoginForm";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin sign-in | kosova.report",
  robots: { index: false, follow: false },
};
export default function AdminLogin() {
  if (currentAdmin()) redirect("/admin");
  const configured = Boolean(adminConfig());
  return (
    <div className="mx-auto w-full max-w-md px-5 py-14">
      <a href="/" className="text-xl font-bold text-[#062653]">
        kosova.report
      </a>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#102344]">Admin sign-in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Authorized staff only. Citizen reports and contact details are
          private.
        </p>
        {configured ? (
          <LoginForm />
        ) : (
          <p
            role="status"
            className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
          >
            Admin access is disabled until credentials are configured on the
            server. Follow the administrator setup instructions in
            REPORTING_SETUP.md.
          </p>
        )}
      </section>
    </div>
  );
}
