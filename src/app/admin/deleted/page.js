import { adminTranslator, adminLanguage } from "../../../lib/admin-language";
import { requireOwner } from "../../../lib/admin-session";
import { database } from "../../../lib/db";
import { siteTitle } from "../../../lib/site-branding";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await adminTranslator();
  return {
    title: `${t("Deletion log")} | ${siteTitle(await adminLanguage())}`,
    robots: { index: false, follow: false },
  };
}

const labels = {
  infrastructure: "Infrastructure",
  environment: "Environment",
  public_services: "Public services",
  administration: "Administration",
  health: "Health",
  education: "Education",
  safety: "Safety",
};
const card = "rounded-lg bg-card shadow-[0_0_0_1px_var(--color-rule)]";
const formatDate = (value) =>
  new Date(value).toLocaleString("en-GB", { timeZone: "Europe/Belgrade", dateStyle: "short", timeStyle: "short" });

// Every report an owner deleted, newest first: which report, who deleted it and when.
export default async function DeletionLog() {
  const t = await adminTranslator();
  await requireOwner();
  let rows = [],
    accounts = [],
    unavailable = false;
  try {
    [[rows], [accounts]] = await Promise.all([
      database().execute(
        "SELECT d.id,d.public_id,d.category,c.name AS city,d.reported_at,d.deleted_by_name,d.deleted_by_email,d.deleted_at FROM report_deletions d LEFT JOIN cities c ON c.id=d.city_id ORDER BY d.deleted_at DESC,d.id DESC LIMIT 500",
      ),
      database().execute(
        "SELECT id,account_name,account_email,account_role,deleted_by_name,deleted_by_email,deleted_at FROM account_deletions ORDER BY deleted_at DESC,id DESC LIMIT 200",
      ),
    ]);
  } catch {
    unavailable = true;
  }
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
      <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.025em]">{t("Deletion log")}</h1>
      <p className="mt-1 max-w-[46rem] text-pencil">
        {t("Reports and staff accounts an admin deleted. They are gone; this page keeps who deleted them and when.")}
      </p>
      {unavailable ? (
        <p role="alert" className="mt-6 rounded-md bg-error-wash p-4 font-semibold text-error">
          {t("Database unavailable")}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-pencil">{t("No report has been deleted.")}</p>
      ) : (
        <ol className={`${card} mt-6 divide-y divide-rule`}>
          {rows.map((row) => (
            <li key={row.id} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
              <div>
                <p className="tabular font-extrabold">{row.public_id}</p>
                <p className="text-sm text-pencil">
                  {[t(labels[row.category] || row.category), row.city].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div>
                <p className="font-semibold">
                  {t("{name} deleted this on {date}")
                    .replace("{name}", row.deleted_by_name)
                    .replace("{date}", formatDate(row.deleted_at))}
                </p>
                <p className="text-sm break-words text-pencil">
                  {row.deleted_by_email}
                  {row.reported_at && <> · {t("Sent {date}").replace("{date}", formatDate(row.reported_at))}</>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {!unavailable && (
        <section aria-labelledby="deleted-accounts" className="mt-10">
          <h2 id="deleted-accounts" className="text-2xl font-extrabold">
            {t("Deleted accounts")}
          </h2>
          {accounts.length === 0 ? (
            <p className="mt-3 text-pencil">{t("No account has been deleted.")}</p>
          ) : (
            <ol className={`${card} mt-4 divide-y divide-rule`}>
              {accounts.map((row) => (
                <li key={row.id} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
                  <div>
                    <p className="font-extrabold">{row.account_name}</p>
                    <p className="text-sm break-words text-pencil">
                      {row.account_email} · {t(row.account_role === "owner" ? "Admin" : "Checker")}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">
                      {t("{name} deleted this on {date}")
                        .replace("{name}", row.deleted_by_name)
                        .replace("{date}", formatDate(row.deleted_at))}
                    </p>
                    <p className="text-sm break-words text-pencil">{row.deleted_by_email}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
