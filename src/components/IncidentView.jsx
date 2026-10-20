"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "../i18n/navigation";
import { Icon, categoryStyle } from "./icons";
import { btn, field } from "./ui";
import { localizedCityName } from "../lib/municipality-names";
import { ACCEPTED, preparePhoto } from "../lib/photos";

const IncidentMap = dynamic(() => import("./IncidentMap"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse bg-wash" />,
});
const MAX_COMMENT_PHOTOS = 3;
let photoId = 0;

// A public issue: what was reported, how many people reported or confirmed it, and the
// conversation around it. Citizen comments are checked by staff before they appear.
export default function IncidentView({ incident: initial }) {
  const t = useTranslations("incident");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const format = useFormatter();
  const [incident, setIncident] = useState(initial);
  const [voteState, setVoteState] = useState("idle");
  const [copied, setCopied] = useState(false);
  const style = categoryStyle[incident.category];
  const date = (value) =>
    value ? format.dateTime(new Date(value), { day: "numeric", month: "long", year: "numeric" }) : "";
  const resolved = incident.status === "Resolved";

  async function toggleVote() {
    setVoteState("busy");
    try {
      const response = await fetch(`/api/incidents/${incident.ref}/vote`, { method: incident.voted ? "DELETE" : "POST" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      setIncident((current) => ({ ...current, voted: data.voted, upvote_count: data.upvote_count ?? current.upvote_count }));
      setVoteState("idle");
    } catch (error) {
      setVoteState(error.message === "429" ? "limited" : "error");
    }
  }
  async function share() {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: `kosova.report · ${tc(`${incident.category}.name`)}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex -rotate-2 items-center gap-2 rounded-sm border-[1.5px] border-current/45 px-3 py-1.5 font-extrabold ${style?.text || ""} ${style?.tint || "bg-wash"}`}
          >
            {style && <Icon name={incident.category} className="size-6" />}
            {tc(`${incident.category}.name`)}
          </span>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${resolved ? "bg-ok-wash text-ok" : "bg-wash text-blue"}`}>
            {t(`statuses.${incident.status}`)}
          </span>
        </p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.03em]">
          {t("heading", { city: localizedCityName(incident.city, locale) })}
        </h1>
        <p className="mt-2 text-lg text-pencil">
          {t("reported", { count: incident.report_count })}
          {incident.upvote_count > 0 && <> · {t("confirms", { count: incident.upvote_count })}</>}
        </p>

        {incident.summary ? (
          <p className="ruled mt-6 text-[1.0625rem] break-words whitespace-pre-wrap">{incident.summary}</p>
        ) : (
          <p className="mt-6 flex items-start gap-2 rounded-md bg-wash p-4 text-sm">
            <Icon name="key" className="mt-0.5 size-4 shrink-0 text-blue" />
            {t("notPublished")}
          </p>
        )}

        {incident.photos.length > 0 && (
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {incident.photos.map((src, index) => (
              <li key={src}>
                <a href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md">
                  <img src={src} alt={t("photo", { n: index + 1 })} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 overflow-hidden rounded-md shadow-[0_0_0_1px_var(--color-rule)]">
          <IncidentMap
            label={t("mapLabel")}
            className="h-72"
            places={[{ key: incident.ref, point: incident.point, exact: incident.exact }]}
          />
        </div>
        {!incident.exact && <p className="mt-2 text-sm text-pencil">{t("approximate")}</p>}

        <Comments incident={incident} />
      </div>

      <aside className="grid content-start gap-5">
        <section className="rounded-lg bg-card p-5 shadow-soft" aria-labelledby="confirm-title">
          <h2 id="confirm-title" className="text-xl font-extrabold">
            {resolved ? t("resolvedTitle") : t("confirmTitle")}
          </h2>
          <p className="mt-1 text-sm text-pencil">{resolved ? t("resolvedBody") : t("confirmBody")}</p>
          {!resolved && (
            <button
              type="button"
              onClick={toggleVote}
              disabled={voteState === "busy"}
              aria-pressed={incident.voted}
              className={`${incident.voted ? btn.primary : btn.soft} mt-4 w-full`}
            >
              <Icon name="thumb" className="size-6" />
              {incident.voted ? t("confirmed") : t("confirm")}
              <span className="tabular rounded-full bg-paper/25 px-2 text-base">{incident.upvote_count}</span>
            </button>
          )}
          <p aria-live="polite" className="mt-2 min-h-5 text-sm font-semibold text-error">
            {voteState === "error" && t("voteError")}
            {voteState === "limited" && t("voteLimited")}
          </p>
          <Link href="/report" className={`${btn.link} mt-1 text-sm`}>
            {resolved ? t("reportAgain") : t("reportOther")}
          </Link>
        </section>

        <section className="rounded-lg bg-card p-5 shadow-soft" aria-labelledby="facts-title">
          <h2 id="facts-title" className="sr-only">
            {t("facts")}
          </h2>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-pencil">{t("firstReported")}</dt>
              <dd className="tabular font-bold">{date(incident.first_reported_at)}</dd>
            </div>
            {incident.report_count > 1 && (
              <div>
                <dt className="text-pencil">{t("lastReported")}</dt>
                <dd className="tabular font-bold">{date(incident.last_reported_at)}</dd>
              </div>
            )}
            {resolved && (
              <div>
                <dt className="text-pencil">{t("resolvedOn")}</dt>
                <dd className="tabular font-bold">{date(incident.resolved_at)}</dd>
              </div>
            )}
          </dl>
          <button type="button" onClick={share} className={`${btn.soft} mt-4 min-h-12 w-full text-sm`}>
            <Icon name={copied ? "check" : "share"} className="size-5" />
            {copied ? t("copied") : t("share")}
          </button>
        </section>
        <p className="text-xs text-pencil">{t("privacyNote")}</p>
      </aside>
    </div>
  );
}

function Comments({ incident }) {
  const t = useTranslations("incident.comments");
  const locale = useLocale();
  const format = useFormatter();
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState([]);
  const [state, setState] = useState("idle");
  const when = (value) =>
    format.dateTime(new Date(value), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  async function addPhotos(event) {
    const files = Array.from(event.target.files || []).slice(0, MAX_COMMENT_PHOTOS - photos.length);
    event.target.value = "";
    for (const original of files) {
      try {
        // Same as report photos: smaller, and location and device details removed.
        const file = await preparePhoto(original);
        setPhotos((current) => [...current, { id: ++photoId, file, url: URL.createObjectURL(file) }]);
      } catch {
        setState("photoError");
      }
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (body.trim().length < 2) return setState("short");
    setState("busy");
    const form = new FormData(event.currentTarget);
    form.set("body", body.trim());
    form.set("name", name.trim());
    form.set("language", locale);
    form.delete("images");
    photos.forEach((photo) => form.append("images", photo.file));
    try {
      const response = await fetch(`/api/incidents/${incident.ref}/comments`, { method: "POST", body: form });
      if (response.status === 429) return setState("limited");
      if (!response.ok) throw new Error();
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setBody("");
      setPhotos([]);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <section aria-labelledby="comments-title" className="mt-10">
      <h2 id="comments-title" className="flex items-center gap-2 text-2xl font-extrabold">
        <Icon name="comment" className="size-6 text-blue" />
        {t("heading")}
        <span className="tabular text-base font-semibold text-pencil">({incident.comments.length})</span>
      </h2>
      {incident.comments.length === 0 ? (
        <p className="mt-3 text-pencil">{t("empty")}</p>
      ) : (
        <ol className="mt-4 grid gap-3">
          {incident.comments.map((comment) => (
            <li
              key={comment.id}
              className={`rounded-md p-4 ${comment.staff ? "bg-wash shadow-[inset_4px_0_0_var(--color-blue)]" : "bg-card shadow-[0_0_0_1px_var(--color-rule)]"}`}
            >
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <b className="font-extrabold">{comment.staff ? t("team") : comment.name || t("citizen")}</b>
                {comment.staff && <span className="rounded-full bg-blue px-2 py-0.5 text-xs font-bold text-on-blue">{t("official")}</span>}
                <span className="tabular text-pencil">{when(comment.created_at)}</span>
              </p>
              <p className="mt-2 break-words whitespace-pre-wrap">{comment.body}</p>
              {comment.photos.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-2">
                  {comment.photos.map((src, index) => (
                    <li key={src}>
                      <a href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-sm">
                        <img src={src} alt={t("photo", { n: index + 1 })} loading="lazy" className="aspect-square w-full object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-lg bg-card p-5 shadow-soft" noValidate>
        <h3 className="text-lg font-extrabold">{t("add")}</h3>
        <label htmlFor="comment-body" className={field.label}>
          {t("body")}
          <span className={field.hint}>{t("bodyHint")}</span>
          <textarea
            id="comment-body"
            rows={4}
            maxLength={1000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={`${field.input} leading-relaxed`}
            aria-invalid={state === "short" || undefined}
          />
        </label>
        <label htmlFor="comment-name" className={field.label}>
          {t("name")} <span className="font-semibold text-pencil">({t("optional")})</span>
          <input
            id="comment-name"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="nickname"
            className={field.input}
          />
        </label>
        {/* For bots only. People never see or fill this. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <div>
          <label className={`${btn.soft} min-h-12 text-sm ${photos.length >= MAX_COMMENT_PHOTOS ? "pointer-events-none opacity-50" : ""}`}>
            <Icon name="camera" className="size-5" />
            {t("addPhoto")}
            <input
              type="file"
              accept={ACCEPTED.join(",")}
              multiple
              onChange={addPhotos}
              disabled={photos.length >= MAX_COMMENT_PHOTOS}
              className="sr-only"
            />
          </label>
          {photos.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <li key={photo.id} className="relative">
                  <img src={photo.url} alt={t("photo", { n: index + 1 })} className="size-20 rounded-sm object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(photo.url);
                      setPhotos((current) => current.filter((p) => p.id !== photo.id));
                    }}
                    className="absolute -top-2 -right-2 inline-flex size-8 items-center justify-center rounded-full bg-card text-error shadow-soft"
                    aria-label={t("removePhoto", { n: index + 1 })}
                  >
                    <Icon name="close" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="flex items-start gap-2 text-sm text-pencil">
          <Icon name="info" className="mt-0.5 size-4 shrink-0" />
          {t("moderated")}
        </p>
        <div aria-live="polite">
          {state === "sent" && <p className="rounded-md bg-ok-wash p-3 text-sm font-semibold text-ok">{t("sent")}</p>}
          {["error", "limited", "short", "photoError"].includes(state) && (
            <p role="alert" className="rounded-md bg-error-wash p-3 text-sm font-semibold text-error">
              {t(state)}
            </p>
          )}
        </div>
        <div>
          <button type="submit" disabled={state === "busy"} className={btn.primary}>
            {state === "busy" ? t("sending") : t("submit")}
          </button>
        </div>
      </form>
    </section>
  );
}
