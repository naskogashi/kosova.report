import { localizedPath } from "../../i18n/paths";
import { Icon } from "../../components/icons";
import { btn, field } from "../../components/ui";
import AdminSubmit from "./AdminSubmit";
import {
  dismissDuplicateAction,
  mergeIncidentAction,
  publishIncidentAction,
  splitReportAction,
  staffCommentAction,
} from "./community/actions";

const card = "rounded-lg bg-card shadow-[0_0_0_1px_var(--color-rule)]";
const linkLabels = { new: "First report", reporter: "Added by the reporter", staff: "Grouped by staff" };
const visibilityLabels = {
  hidden: ["Hidden", "Nothing about this issue is public."],
  listed: ["Listed", "Category, approximate area, dates and counts are public. No text or photos."],
  public: ["Public", "Also your summary below, the exact pin and the photos you tick."],
};

// The issue a report belongs to: the other reports of the same problem, possible duplicates,
// what the public sees, and official updates. Checkers see it read-only.
export default function IncidentPanel({ t, owner, reportId, incident, siblings, candidates, photos, events, formatDate, labels, statuses }) {
  const publicURL = localizedPath("/incident/[ref]", "sq", { ref: incident.ref });
  return (
    <section className={`${card} grid gap-5 p-5`} aria-labelledby="incident-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="incident-title" className="flex items-center gap-2 font-extrabold">
            <Icon name="group" className="size-5 text-blue" />
            {t("Issue")} <span className="tabular">#{incident.ref}</span>
          </h3>
          <p className="mt-1 text-sm text-pencil">
            {incident.report_count} {t("reports")} · {incident.upvote_count} {t("thumbs-up")} · {incident.comment_count}{" "}
            {t("published comments")} · {t(visibilityLabels[incident.visibility][0])}
          </p>
        </div>
        {incident.visibility !== "hidden" && (
          <a href={publicURL} target="_blank" rel="noopener noreferrer" className={`${btn.soft} min-h-11 px-4 text-sm`}>
            {t("Open public page")}
          </a>
        )}
      </div>

      {siblings.length > 1 && (
        <div>
          <h4 className="text-sm font-bold text-pencil">{t("Reports of this problem")}</h4>
          <ul className="mt-2 grid gap-2">
            {siblings.map((sibling) => (
              <li key={sibling.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <a
                  href={`/admin?report=${sibling.id}`}
                  aria-current={String(sibling.id) === String(reportId) ? "true" : undefined}
                  className="tabular font-bold text-blue underline underline-offset-4 aria-[current=true]:text-ink aria-[current=true]:no-underline"
                >
                  {sibling.public_id}
                </a>
                <span className="text-pencil">
                  {formatDate(sibling.created_at, t)} · {t(linkLabels[sibling.incident_link] || sibling.incident_link)}
                </span>
                {owner && (
                  <form action={splitReportAction} className="ml-auto">
                    <input type="hidden" name="report_id" value={sibling.id} />
                    <input type="hidden" name="back" value={reportId} />
                    <button className={`${btn.link} min-h-9 text-sm`}>{t("Not the same problem: separate")}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="rounded-md bg-wash p-4">
          <h4 className="font-extrabold">{t("Possible duplicates")}</h4>
          <p className="mt-1 text-sm text-pencil">
            {t("Nearby and similar. Close is not proof: check the descriptions and photos before merging.")}
          </p>
          <ul className="mt-3 grid gap-3">
            {candidates.map((candidate) => (
              <li key={`${candidate.incident_id}-${candidate.candidate_id}`} className="rounded-md bg-card p-3 text-sm">
                <p>
                  <a href={`/admin?report=${candidate.report_id}`} className="tabular font-bold text-blue underline underline-offset-4">
                    #{candidate.other_ref}
                  </a>{" "}
                  · {t(labels[candidate.category] || candidate.category)} · {candidate.report_count} {t("reports")} ·{" "}
                  {t(statuses[candidate.status] || candidate.status)} ·{" "}
                  {candidate.distance_m} m · {t("score")} {Number(candidate.score).toFixed(2)}
                </p>
                {candidate.source === "reporter_declined" && (
                  <p className="mt-1 font-semibold text-stamp">{t("The reporter said this is a different problem.")}</p>
                )}
                {owner && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={mergeIncidentAction}>
                      <input type="hidden" name="source_id" value={candidate.newer_id} />
                      <input type="hidden" name="target_ref" value={candidate.older_ref} />
                      <input type="hidden" name="back" value={reportId} />
                      <AdminSubmit>
                        {t("Same problem: merge")} #{candidate.newer_ref} → #{candidate.older_ref}
                      </AdminSubmit>
                    </form>
                    <form action={dismissDuplicateAction}>
                      <input type="hidden" name="incident_id" value={candidate.incident_id} />
                      <input type="hidden" name="candidate_id" value={candidate.candidate_id} />
                      <input type="hidden" name="back" value={reportId} />
                      <button className={`${btn.soft} min-h-11 px-4 text-sm`}>{t("Different problems")}</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {owner && (
        <>
          <form action={mergeIncidentAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="source_id" value={incident.id} />
            <input type="hidden" name="back" value={reportId} />
            <label className={`${field.label} min-w-0 flex-1 text-sm`}>
              {t("Merge this issue into another")}
              <span className={field.hint}>{t("Paste the 10-character reference of the issue to keep.")}</span>
              <input name="target_ref" required pattern="[0-9a-f]{10}" maxLength={10} className={`${field.input} tabular min-h-11 py-2`} />
            </label>
            <AdminSubmit>{t("Merge")}</AdminSubmit>
          </form>

          <form action={publishIncidentAction} className="grid gap-4 border-t border-rule pt-5">
            <input type="hidden" name="incident_id" value={incident.id} />
            <input type="hidden" name="back" value={reportId} />
            <fieldset>
              <legend className={field.label}>{t("What the public sees")}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {Object.entries(visibilityLabels).map(([key, [label, hint]]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer gap-2 rounded-md border-[1.5px] border-rule p-3 text-sm has-checked:border-blue has-checked:bg-wash"
                  >
                    <input type="radio" name="visibility" value={key} defaultChecked={incident.visibility === key} className="mt-0.5 accent-[var(--color-blue)]" />
                    <span>
                      <b className="block">{t(label)}</b>
                      <span className="text-pencil">{t(hint)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={field.label}>
              {t("Public summary")}
              <span className={field.hint}>
                {t("Written by staff, never copied blindly from a report. Leave out names, phone numbers, plates and house numbers.")}
              </span>
              <textarea name="summary" rows={3} maxLength={600} defaultValue={incident.public_summary} className={field.input} />
            </label>
            {photos.length > 0 && (
              <fieldset>
                <legend className={field.label}>{t("Public photos")}</legend>
                <p className={field.hint}>{t("Only tick photos without faces, plates or private places.")}</p>
                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <li key={photo.id}>
                      <label className="block cursor-pointer overflow-hidden rounded-md shadow-[0_0_0_1px_var(--color-rule)] has-checked:shadow-[0_0_0_3px_var(--color-blue)]">
                        <img src={`/api/admin/images/${photo.id}`} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                        <span className="flex items-center gap-2 p-2 text-xs font-bold">
                          <input type="checkbox" name="photo" value={photo.id} defaultChecked={Boolean(Number(photo.public))} className="accent-[var(--color-blue)]" />
                          {t("Show")}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
            <div>
              <AdminSubmit>{t("Save publication")}</AdminSubmit>
            </div>
          </form>

          {incident.visibility !== "hidden" && (
            <form action={staffCommentAction} className="grid gap-3 border-t border-rule pt-5">
              <input type="hidden" name="incident_id" value={incident.id} />
              <input type="hidden" name="back" value={reportId} />
              <label className={field.label}>
                {t("Official update")}
                <span className={field.hint}>{t("Published at once on the public page as the kosova.report team.")}</span>
                <textarea name="body" required rows={2} maxLength={2000} className={field.input} />
              </label>
              <div>
                <AdminSubmit>{t("Post update")}</AdminSubmit>
              </div>
            </form>
          )}
        </>
      )}

      {events.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-bold text-blue">{t("Grouping history")}</summary>
          <ol className="mt-2 grid gap-1 text-sm">
            {events.map((event, index) => (
              <li key={index}>
                <span className="tabular text-pencil">{formatDate(event.created_at, t)}</span> · {event.actor_email} · {event.detail || event.action}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
