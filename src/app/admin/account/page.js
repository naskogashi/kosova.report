import { siteTitle } from "../../../lib/site-branding";
import { adminTranslator, adminLanguage } from "../../../lib/admin-language";
import { requireAdmin } from "../../../lib/admin-session";
import AccountForm from "./AccountForm";
import AccountForms from "./AccountForms";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await adminTranslator();
  return {
    title: `${t("My account")} | ${siteTitle(await adminLanguage())}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}
export default async function Account() {
  const t = await adminTranslator();
  const account = await requireAdmin({
    allowPasswordChange: true,
  });
  // First sign-in: one form that replaces the one-time password. Afterwards: details and password separately.
  if (!account.must_change_password)
    return (
      <div className="mx-auto w-full max-w-7xl *:max-w-5xl px-4 pb-8 sm:px-6">
        <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.025em]">{t("My account")}</h1>
        <div className="mt-6">
          <AccountForms account={{ name: account.name, email: account.email }} />
        </div>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-7xl *:max-w-5xl px-4 pb-8 sm:px-6">
      <section className="mt-6 max-w-lg rounded-lg bg-card p-6 shadow-[0_0_0_1px_var(--color-rule)]">
        <h1 className="text-2xl font-bold">{t("My account")}</h1>
        {Boolean(account.must_change_password) && (
          <p className="mt-4 rounded-sm bg-wash p-3 text-sm text-stamp">
            {" "}
            {t(
              "Replace your one-time password to finish signing in. This temporary session expires in 30 minutes.",
            )}{" "}
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
