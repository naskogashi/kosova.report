import { Icon, categoryStyle } from "../../../components/icons";

// Statistics charts in plain HTML/CSS. Colours come from the validated chart ramp
// (--color-chart-1..3, one hue light to dark). Every mark has a hover/focus
// tooltip, values are labelled sparingly, and the tables below each chart carry
// the full numbers.

const tip =
  "pointer-events-none absolute z-10 hidden w-max max-w-[14rem] rounded-sm bg-ink px-2.5 py-1.5 text-xs font-semibold text-paper shadow-lift group-hover:block group-focus-visible:block";

// Clean axis maximum: 1, 2, 5, 10, 20, 50…
function niceMax(value) {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map((step) => step * power).find((step) => step >= value);
}

// Stages of a report as one 100% bar, with a legend that also gives counts.
export function StatusSplit({ parts, total, label }) {
  const sum = parts.reduce((s, p) => s + p.value, 0);
  return (
    <figure className="grid gap-3">
      <div className="flex h-6 gap-0.5" role="img" aria-label={label}>
        {sum === 0 ? (
          <div className="h-full w-full rounded-sm bg-wash" />
        ) : (
          parts
            .filter((p) => p.value > 0)
            .map((part) => (
              <div
                key={part.key}
                tabIndex={0}
                className="group relative h-full first:rounded-l-[4px] last:rounded-r-[4px] focus-visible:outline-offset-2"
                style={{ width: `${(part.value / sum) * 100}%`, background: part.color }}
              >
                <span className={`${tip} bottom-8 left-0`}>
                  {part.label}: {part.value} ({Math.round((part.value / sum) * 100)}%)
                </span>
              </div>
            ))
        )}
      </div>
      <figcaption>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {parts.map((part) => (
            <li key={part.key} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-[3px]" style={{ background: part.color }} />
              <span className="text-pencil">{part.label}</span>
              <b className="tabular font-bold">{part.value}</b>
              {sum > 0 && <span className="tabular text-pencil">{Math.round((part.value / sum) * 100)}%</span>}
            </li>
          ))}
          <li className="text-pencil">
            {total}
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}

// New reports per day, last 30 days, as columns from one baseline.
export function DailyColumns({ days, label, empty, locale }) {
  const max = Math.max(0, ...days.map((d) => d.total));
  const top = niceMax(max);
  const peak = days.findIndex((d) => d.total === max && max > 0);
  const short = (iso) => {
    const [, m, d] = iso.split("-");
    return `${d}.${m}`;
  };
  if (max === 0) return <p className="rounded-sm bg-wash p-4 text-sm text-pencil">{empty}</p>;
  return (
    <figure className="grid grid-cols-[2rem_1fr] gap-x-2" role="img" aria-label={label}>
      <div className="tabular relative h-44 text-right text-xs text-pencil" aria-hidden="true">
        <span className="absolute top-0 right-0 -translate-y-1/2">{top}</span>
        <span className="absolute top-1/2 right-0 -translate-y-1/2">{top / 2 === Math.round(top / 2) ? top / 2 : ""}</span>
        <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
      </div>
      <div className="relative h-44">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-rule" />
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-rule" />
        <div className="absolute inset-0 flex items-end gap-0.5 shadow-[inset_0_-1px_0_var(--color-pencil)]">
          {days.map((day, index) => (
            <div
              key={day.day}
              tabIndex={0}
              aria-label={`${short(day.day)}: ${day.total}`}
              className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-offset-1"
            >
              {day.total > 0 && (
                <div
                  className="w-full max-w-6 rounded-t-[4px] bg-chart-2 group-hover:bg-chart-3 group-focus-visible:bg-chart-3"
                  style={{ height: `${(day.total / top) * 100}%` }}
                />
              )}
              {index === peak && (
                <span className="tabular absolute text-xs font-bold" style={{ bottom: `calc(${(day.total / top) * 100}% + 4px)` }}>
                  {day.total}
                </span>
              )}
              <span className={`${tip} bottom-full mb-1 ${index > days.length - 6 ? "right-0" : "left-0"}`}>
                {new Date(`${day.day}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long" })}: {day.total}
              </span>
            </div>
          ))}
        </div>
      </div>
      <span />
      <div className="tabular mt-2 flex justify-between text-xs text-pencil" aria-hidden="true">
        {days.filter((_, i) => i % 7 === 0 || i === days.length - 1).map((day) => (
          <span key={day.day}>{short(day.day)}</span>
        ))}
      </div>
    </figure>
  );
}

// One measure per category: single hue, the category named and shown by its icon.
export function CategoryBars({ rows, label }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-2.5" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(8rem,12rem)_1fr] items-center gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-sm ${categoryStyle[row.key]?.text} ${categoryStyle[row.key]?.tint}`}>
              <Icon name={row.key} className="size-4" />
            </span>
            <span className="truncate">{row.label}</span>
          </span>
          <span className="group relative flex items-center gap-2" tabIndex={0}>
            <span className="h-5 rounded-r-[4px] bg-chart-2 group-hover:bg-chart-3" style={{ width: `${Math.max(row.value ? 1.5 : 0, (row.value / max) * 85)}%` }} />
            <b className="tabular text-sm font-bold">{row.value}</b>
            <span className={`${tip} bottom-7 left-0`}>
              {row.label}: {row.value}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// Per department: resolved and still open, stacked from one baseline, with a legend.
export function DepartmentBars({ rows, legend, label }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <figure className="grid gap-4">
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-[3px]" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
      <ul className="grid gap-3" aria-label={label}>
        {rows.map((row) => (
          <li key={row.name} className="grid gap-1.5">
            <span className="truncate text-sm font-semibold">{row.name}</span>
            <span className="group relative flex items-center gap-2" tabIndex={0}>
              <span className="flex h-5 gap-0.5" style={{ width: `${(row.total / max) * 85}%` }}>
                {row.resolved > 0 && <span className="h-full rounded-l-[4px] last:rounded-r-[4px]" style={{ width: `${(row.resolved / row.total) * 100}%`, background: legend[0].color }} />}
                {row.total - row.resolved > 0 && <span className="h-full first:rounded-l-[4px] rounded-r-[4px]" style={{ width: `${((row.total - row.resolved) / row.total) * 100}%`, background: legend[1].color }} />}
              </span>
              <b className="tabular shrink-0 text-sm font-bold">{Math.round((row.resolved / row.total) * 100)}%</b>
              <span className={`${tip} bottom-7 left-0`}>
                {row.name}: {row.resolved} / {row.total}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
