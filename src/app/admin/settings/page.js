import { existsSync } from "node:fs";
import path from "node:path";
import { siteTitle } from "../../../lib/site-branding";
import { adminTranslator, adminLanguage } from "../../../lib/admin-language";
import { database } from "../../../lib/db";
import { requireOwner } from "../../../lib/admin-session";
import {
  saveCountryAction,
  saveCityAction,
  toggleCheckerAction,
} from "../actions";
import AdminSubmit from "../AdminSubmit";
import CheckerForm from "./CheckerForm";
import DepartmentRouting from "./DepartmentRouting";
import { categories } from "../../../lib/report-options";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await adminTranslator();
  return {
    title: `${t("Platform settings")} | ${siteTitle(await adminLanguage())}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}
const input =
  "mt-1 block w-full rounded-sm border border-rule bg-card p-2.5 text-sm";
async function CityForm({ city, countries }) {
  const t = await adminTranslator();
  return (
    <form
      action={saveCityAction}
      className="grid items-end gap-3 rounded-md bg-paper p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <input type="hidden" name="id" value={city?.id || ""} />
      <label className="text-xs font-semibold">
        {" "}
        {t("Country")}{" "}
        <select
          className={input}
          name="country_id"
          required
          defaultValue={city?.country_id}
        >
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold">
        {" "}
        {t("City name")}{" "}
        <input
          className={input}
          name="name"
          defaultValue={city?.name || ""}
          required
          maxLength={100}
        />
      </label>
      <label className="text-xs font-semibold">
        {" "}
        {t("Public ID prefix")}{" "}
        <input
          className={input}
          name="code"
          defaultValue={city?.code || ""}
          required
          maxLength={10}
          pattern="[A-Za-z0-9]{2,10}"
        />
      </label>
      <label className="text-xs font-semibold">
        {" "}
        {t("Map latitude")}{" "}
        <input
          className={input}
          name="latitude"
          type="number"
          step="any"
          min={-90}
          max={90}
          defaultValue={city?.latitude ?? 42.6629}
          required
        />
      </label>
      <label className="text-xs font-semibold">
        {" "}
        {t("Map longitude")}{" "}
        <input
          className={input}
          name="longitude"
          type="number"
          step="any"
          min={-180}
          max={180}
          defaultValue={city?.longitude ?? 21.1655}
          required
        />
      </label>
      <label className="text-xs font-semibold">
        {" "}
        {t("Initial zoom")}{" "}
        <input
          className={input}
          name="zoom"
          type="number"
          min={3}
          max={18}
          defaultValue={city?.zoom_level || 13}
          required
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-xs">
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={Boolean(city?.enabled)}
        />{" "}
        {t("Enable public reporting")}{" "}
      </label>
      <AdminSubmit>{city ? t("Save city") : t("Add city")}</AdminSubmit>
    </form>
  );
}
export default async function Settings(props) {
  const searchParams = await props.searchParams;
  const t = await adminTranslator();
  await requireOwner();
  let countries = [],
    municipalities = [],
    departments = [],
    routes = [],
    checkers = [];
  try {
    const results = await Promise.all([
      database().execute("SELECT id,name,code FROM countries ORDER BY name"),
      database().execute(
        "SELECT c.id,c.name,c.code,c.country_id,m.enabled,m.latitude,m.longitude,m.zoom_level FROM cities c LEFT JOIN municipality_settings m ON m.city_id=c.id ORDER BY c.name",
      ),
      database().execute(
        "SELECT d.id,d.name,d.city_id,d.notification_email,c.code AS city_code FROM departments d JOIN cities c ON c.id=d.city_id ORDER BY c.name,d.name",
      ),
      database().execute(
        "SELECT routing.city_id,routing.category,routing.department_id,routing.active,c.code AS city_code FROM department_routes routing JOIN cities c ON c.id=routing.city_id ORDER BY c.name,routing.category",
      ),
      database().execute(
        "SELECT id,name,email,role,active,must_change_password FROM staff_accounts ORDER BY role='owner' DESC,name",
      ),
    ]);
    [countries, municipalities, departments, routes, checkers] = results.map(
      (result) => result[0],
    );
  } catch {
    return (
      <div className="mx-auto max-w-xl p-8">
        <a href="/admin">{t("Admin panel")}</a>
        <h1 className="mt-4 text-xl font-bold">{t("Settings unavailable")}</h1>
        <p className="mt-3">
          {" "}
          {t(
            "Run the server setup command and check MySQL configuration.",
          )}{" "}
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 pt-6 pb-8 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-[-0.025em] text-ink">
        {t("Platform settings")}
      </h1>
      {searchParams.saved && (
        <p
          role="status"
          className="rounded-sm bg-ok-wash p-3 text-sm text-ok"
        >
          {" "}
          {t("Changes saved.")}{" "}
        </p>
      )}
      {searchParams.error && (
        <p
          role="alert"
          className="rounded-sm bg-error-wash p-3 text-sm text-error"
        >
          {" "}
          {t(
            "Could not save. Check unique codes, valid data and matching municipality/department selections. City prefixes cannot change after reports exist.",
          )}{" "}
        </p>
      )}
      <section
        id="geography"
        className="space-y-5 rounded-md border bg-card p-5"
      >
        <h2 className="text-xl font-bold">{t("Countries and cities")}</h2>
        <p className="text-sm text-pencil">
          {" "}
          {t(
            "Only Prishtina starts enabled. Add countries/cities here and explicitly enable them when ready. A city also needs active department routes before citizens can report there.",
          )}{" "}
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {countries.map((country) => (
            <form
              key={country.id}
              action={saveCountryAction}
              className="flex flex-wrap items-end gap-3 rounded-sm bg-paper p-4"
            >
              <input name="id" type="hidden" value={country.id} />
              <label className="flex-1 text-xs font-semibold">
                {" "}
                {t("Country")}{" "}
                <input
                  className={input}
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={country.name}
                />
              </label>
              <label className="w-24 text-xs font-semibold">
                {" "}
                {t("Code")}{" "}
                <input
                  className={input}
                  name="code"
                  required
                  maxLength={10}
                  defaultValue={country.code}
                />
              </label>
              <AdminSubmit>{t("Save")}</AdminSubmit>
            </form>
          ))}
        </div>
        <form
          action={saveCountryAction}
          className="flex flex-wrap items-end gap-3 border-t pt-4"
        >
          <input name="id" type="hidden" value="" />
          <label className="flex-1 text-xs font-semibold">
            {" "}
            {t("New country name")}{" "}
            <input className={input} name="name" required maxLength={100} />
          </label>
          <label className="w-28 text-xs font-semibold">
            {" "}
            {t("Country code")}{" "}
            <input className={input} name="code" required maxLength={10} />
          </label>
          <AdminSubmit>{t("Add country")}</AdminSubmit>
        </form>
        <h3 className="font-semibold">{t("Existing cities")}</h3>
        {municipalities.map((city) => (
          <div key={city.id} className="grid gap-2">
            <CityForm city={city} countries={countries} />
            {/* Official municipal border used to accept or refuse a pin (public/boundaries/<CODE>.json). */}
            {existsSync(path.join(process.cwd(), "public", "boundaries", `${String(city.code).toUpperCase()}.json`)) ? (
              <p className="text-sm font-semibold text-ok">{t("Official boundary on file. Pins outside it are refused.")}</p>
            ) : (
              <p className="text-sm text-pencil">
                {t("No official boundary yet. Until one is added, pins within 20 km of the map centre are accepted. Add it with:")}{" "}
                <code className="rounded-sm bg-wash px-1.5 py-0.5">npm run boundary -- --code {String(city.code).toUpperCase()} --relation &lt;OSM id&gt;</code>
              </p>
            )}
          </div>
        ))}
        <h3 className="font-semibold">{t("Add a city")}</h3>
        <CityForm countries={countries} />
      </section>
      <section className="space-y-3 rounded-md border border-rule bg-wash p-5">
        <h2 className="text-xl font-bold">{t("Reporting readiness")}</h2>
        <p className="text-sm text-pencil">
          {t(
            "Choose an enabled city and assign each category to a department with a valid notification email. Creating a city alone does not configure its recipients.",
          )}
        </p>
        {municipalities.map((city) => {
          const assigned = new Set(
            routes
              .filter(
                (route) =>
                  String(route.city_id) === String(city.id) &&
                  Number(route.active) === 1 &&
                  departments.some(
                    (department) =>
                      String(department.id) === String(route.department_id) &&
                      String(department.city_id) === String(city.id),
                  ),
              )
              .map((route) => route.category),
          );
          const missing = categories.filter(
            (category) => !assigned.has(category),
          );
          return (
            <div key={city.id} className="rounded-sm bg-card p-3 text-sm">
              <p className="font-semibold">
                {city.name} ·{" "}
                {Number(city.enabled) !== 1
                  ? t("Not enabled")
                  : missing.length
                    ? t("Missing category assignments")
                    : t("Ready for all categories")}
              </p>
              {!!missing.length && (
                <p className="mt-1 text-pencil">
                  {missing
                    .map((category) => t(category.replaceAll("_", " ")))
                    .join(", ")}
                </p>
              )}
            </div>
          );
        })}
        <a
          href="#departments"
          className="inline-flex min-h-11 items-center rounded-sm bg-blue-press px-4 py-2 text-sm font-semibold text-on-blue"
        >
          {t("Configure recipients")}
        </a>
      </section>
      <DepartmentRouting
        departments={departments}
        municipalities={municipalities}
        routes={routes}
      />
      <section
        id="checkers"
        className="space-y-5 rounded-md border bg-card p-5"
      >
        <h2 className="text-xl font-bold">{t("Staff accounts")}</h2>
        <p className="text-sm text-pencil">
          {t(
            "Admins manage everything, including settings, news and other accounts. Checkers can view and verify assigned reports. They cannot change platform settings, reassign reports, or mark municipal issues resolved.",
          )}
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {checkers.filter((account) => account.role === "owner").map((owner) => (
            <div key={owner.id} className="space-y-1 rounded-md bg-paper p-4">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {owner.name}
                <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-paper">{t("Admin")}</span>
              </p>
              <p className="break-all text-sm text-pencil">{owner.email}</p>
              <p className="text-xs text-pencil">
                {owner.must_change_password ? t("First sign-in not finished") : t("Account ready")}
              </p>
            </div>
          ))}
          {checkers.filter((account) => account.role !== "owner").map((checker) => (
            <div
              key={checker.id}
              className="space-y-4 rounded-md bg-paper p-4"
            >
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {checker.name}
                <span className="rounded-full bg-wash px-2.5 py-0.5 text-xs font-bold text-blue">{t("Checker")}</span>
              </p>
              <p className="break-all text-sm text-pencil">
                {checker.email}
              </p>
              <p className="text-xs text-pencil">
                {checker.must_change_password
                  ? t("First sign-in not finished")
                  : t("Account ready")}
              </p>
              <form
                action={toggleCheckerAction}
                className="flex items-center gap-4"
              >
                <input name="id" type="hidden" value={checker.id} />
                <label className="text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={Boolean(checker.active)}
                    className="mr-2"
                  />{" "}
                  {t("Active")}{" "}
                </label>
                <AdminSubmit>{t("Save access")}</AdminSubmit>
              </form>
              <CheckerForm id={checker.id} />
            </div>
          ))}
        </div>
        <div className="max-w-md">
          <h3 className="mb-3 font-semibold">{t("Add an account")}</h3>
          <CheckerForm />
        </div>
      </section>
    </div>
  );
}
