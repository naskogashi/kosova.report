import { useTranslations, useFormatter } from "next-intl";
import Wordmark from "./Wordmark";
import Stamp from "./Stamp";
import { Icon, categoryStyle } from "./icons";
import { cityMaps, covers, formatCoords, project } from "../lib/city-map";

// The report as a physical slip. It fills in during the flow and is stamped after sending.
// The PDF proof is drawn from the same fields in the same order.
export default function Receipt({
  publicId,
  category,
  cityName,
  cityCode = "PR",
  position,
  description,
  photos = [],
  photoCount,
  anonymous,
  submittedAt,
  stamped = false,
  label,
  stub,
  className = "",
}) {
  const t = useTranslations("receipt");
  const tc = useTranslations("categories");
  const ts = useTranslations("sent");
  const tr = useTranslations("report");
  const format = useFormatter();
  const map = cityMaps[cityCode];
  const valid = position?.every?.(Number.isFinite);
  const snippet = map && valid && covers(map, position) ? project(map, position) : null;
  const count = photoCount ?? photos.length;
  const date = submittedAt
    ? format.dateTime(new Date(submittedAt), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const style = category ? categoryStyle[category] : null;
  const empty =
    "rounded-sm border-[1.5px] border-dashed border-rule px-3 py-2.5 text-sm text-pencil";
  return (
    <div
      className={`relative w-full max-w-[27.5rem] drop-shadow-[0_20px_30px_var(--shadow-tint)] ${className}`}
      style={{ viewTransitionName: "receipt" }}
    >
      <article
        className={`relative overflow-hidden bg-card p-6 ${stub ? "rounded-t-lg" : "rounded-lg"}`}
        aria-label={t("kind")}
      >
        <div className="flex items-center justify-between gap-3">
          <Wordmark className="text-[1.05rem]" />
          {label && (
            <span className="rounded-full bg-wash px-2.5 py-1 text-xs font-bold text-pencil">
              {label}
            </span>
          )}
        </div>
        <p className="mt-4 text-sm text-pencil">
          {t("kind")}
          {cityName ? `, ${cityName}` : ""}
        </p>
        {publicId ? (
          <p className="tabular text-[1.75rem] leading-tight font-extrabold tracking-[-0.01em]">
            {publicId}
          </p>
        ) : (
          <p className="text-lg font-bold text-pencil">{t("draft")}</p>
        )}
        <hr className="my-4 border-rule" />

        {style ? (
          <span
            data-part="category"
            className={`stamp-in inline-flex -rotate-2 items-center gap-2 rounded-sm border-[1.5px] px-3 py-1.5 font-extrabold ${style.text} ${style.tint} border-current/45`}
          >
            <Icon name={category} className="size-6" />
            {tc(`${category}.name`)}
          </span>
        ) : (
          <p className={empty}>{tr("emptyCategory")}</p>
        )}

        <dl data-part="place" className="mt-4 grid gap-3">
          <div className="grid grid-cols-[5.5rem_1fr] gap-3">
            <dt className="pt-0.5 text-sm text-pencil">{t("place")}</dt>
            <dd className="min-w-0 font-semibold">
              {valid ? (
                <>
                  {cityName}
                  <span className="tabular mt-1 block text-xs font-semibold text-pencil">
                    {formatCoords(position)}
                  </span>
                </>
              ) : (
                <span className="block h-5 w-2/3 rounded-sm bg-wash" />
              )}
            </dd>
          </div>
        </dl>
        {snippet && (
          <figure data-part="place" className="mt-3 aspect-[11/6] max-w-full overflow-hidden rounded-md bg-paper">
            <svg
              viewBox={`${snippet[0] - 55} ${snippet[1] - 33} 110 60`}
              preserveAspectRatio="xMidYMid slice"
              className="block size-full"
              aria-hidden="true"
            >
              <use
                href={`${map.src}#minor`}
                className="fill-none stroke-rule"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <use
                href={`${map.src}#major`}
                className="fill-none stroke-pencil/50"
                strokeWidth="2.4"
                vectorEffect="non-scaling-stroke"
              />
              <g transform={`translate(${snippet[0]} ${snippet[1]}) scale(.42)`} className="pin-drop">
                <path
                  d="M0 0C0 0-11-12.5-11-20a11 11 0 0 1 22 0C11-12.5 0 0 0 0Z"
                  className="fill-gold stroke-card"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cy="-20" r="4" className="fill-ink" />
              </g>
            </svg>
          </figure>
        )}

        {description ? (
          <p data-part="words" className="ruled mt-4 text-[1.0625rem] break-words whitespace-pre-wrap">
            {description}
          </p>
        ) : (
          <div className="mt-4 grid gap-2.5" aria-hidden="true">
            <span className="h-px bg-rule" />
            <span className="h-px bg-rule" />
            <span className="h-px w-2/3 bg-rule" />
          </div>
        )}

        {photos.length > 0 ? (
          <ul data-part="words" className="mt-5 flex flex-wrap gap-3" aria-label={t("photos")}>
            {photos.slice(0, 4).map((url, index) => (
              <li
                key={url}
                className="clip-in relative w-24 rotate-[-3deg] rounded-sm border-4 border-card shadow-[0_0_0_1px_var(--color-rule),0_6px_14px_-8px_var(--shadow-tint)] even:rotate-[2.5deg]"
              >
                <img src={url} alt="" className="aspect-[4/3] w-full rounded-[4px] object-cover" />
                <svg
                  viewBox="0 0 14 34"
                  className="absolute -top-3.5 left-3 h-8 w-3.5 text-pencil"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 12V5a3 3 0 0 1 6 0v20a5 5 0 0 1-10 0V9" />
                </svg>
              </li>
            ))}
            {photos.length > 4 && (
              <li className="flex items-center text-sm font-bold text-pencil">
                +{photos.length - 4}
              </li>
            )}
          </ul>
        ) : (
          count > 0 && (
            <p className="mt-4 text-sm font-semibold">{t("photoCount", { count })}</p>
          )
        )}

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {date && (
            <span className="text-pencil">
              {t("submitted")} <b className="tabular font-bold text-ink">{date}</b>
            </span>
          )}
          {anonymous !== undefined && (
            <span className="text-pencil">
              {t("mode")}{" "}
              <b className="font-bold text-ink">{anonymous ? t("anonymous") : t("named")}</b>
            </span>
          )}
          {photos.length > 0 && (
            <span className="text-pencil">
              {t("photos")} <b className="tabular font-bold text-ink">{photos.length}</b>
            </span>
          )}
        </div>

        {stamped && (
          <Stamp
            word={ts("stamp")}
            city={cityName || ""}
            publicId={publicId}
            date={date?.split(",")[0]}
            data-part="stamp"
            className="stamp-hit pointer-events-none absolute right-2 bottom-14 w-40 -rotate-12 text-stamp opacity-90 mix-blend-multiply dark:mix-blend-normal"
          />
        )}
      </article>
      {stub}
    </div>
  );
}
