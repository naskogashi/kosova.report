import { requireAdmin } from "../../../lib/admin-session";
import AccountForm from "./AccountForm";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "My account | kosova.report",
  robots: { index: false, follow: false },
};
export default async function Account() {
  const account = await requireAdmin({ allowPasswordChange: true });
  return (
    <div className="mx-auto w-full max-w-lg px-5 py-10">
      <a href="/admin" className="text-sm text-blue-800">
        Admin panel
      </a>
      <section className="mt-5 rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-bold">My account</h1>
        {Boolean(account.must_change_password) && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Replace your one-time password to finish signing in. This temporary
            session expires in 30 minutes.
          </p>
        )}
        <AccountForm
          account={{
            name: account.name,
            email: account.email,
            must_change_password: Boolean(account.must_change_password),
          }}
        />
      </section>
    </div>
  );
}
