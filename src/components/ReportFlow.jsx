"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition, ViewTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "../i18n/navigation";
import Receipt from "./Receipt";
import Sheet from "./Sheet";
import { Icon, categoryStyle } from "./icons";
import { btn, field, wrap } from "./ui";
import { categories } from "../lib/report-options";
import { localizedCityName } from "../lib/municipality-names";
import { formatCoords } from "../lib/city-map";
import { boundaryOutline, insideBoundary } from "../lib/boundary-geometry";
import { ACCEPTED, MAX_BYTES, MAX_PHOTOS, preparePhoto } from "../lib/photos";
import { clearDraft, keepReceipt, loadDraft, saveDraft } from "../lib/draft-store";

const ReportMap = dynamic(() => import("./ReportMap"), {
  ssr: false,
  loading: () => <div className="h-[min(58svh,26rem)] w-full animate-pulse bg-wash" />,
});

// Fallback for a city whose official boundary file (public/boundaries/<CODE>.json)
// hasn't been added yet: a pin further than this from its centre counts as outside.
const CITY_RADIUS_KM = 20;
function distanceKm([lat1, lng1], [lat2, lng2]) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
const validPoint = (p) =>
  Array.isArray(p) && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let photoId = 0;

export default function ReportFlow() {
  const t = useTranslations("report");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();

  const [options, setOptions] = useState({ status: "loading", cities: [] });
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [position, setPosition] = useState(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [anonymous, setAnonymous] = useState(true);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [checked, setChecked] = useState(false);
  const [locating, setLocating] = useState("idle");
  const [tileError, setTileError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [queued, setQueued] = useState(false);
  const [online, setOnline] = useState(true);
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const heading = useRef(null);
  const sending = useRef(false);
  const sent = useRef(false);

  // Reporting options: enabled municipalities and the categories routed in each.
  const loadOptions = useCallback(() => {
    setOptions((current) => ({ ...current, status: "loading" }));
    fetch("/api/report-options", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setOptions({ status: "ready", cities: data.cities });
        if (data.cities.length === 1) setCity((value) => value || data.cities[0].code);
      })
      .catch(() => setOptions((current) => ({ ...current, status: "error" })));
  }, []);
  useEffect(loadOptions, [loadOptions]);

  // Restore a draft, otherwise honour ?category= from the landing page index.
  useEffect(() => {
    let alive = true;
    loadDraft().then((draft) => {
      if (!alive) return;
      if (draft && (draft.category || draft.description || draft.photos?.length)) {
        setCategory(draft.category || "");
        setCity(draft.city || "");
        setPosition(validPoint(draft.position) ? draft.position : null);
        setDescription(draft.description || "");
        setAnonymous(draft.anonymous ?? true);
        setEmail(draft.email || "");
        setPhotos(
          (draft.photos || []).map((file) => ({
            id: ++photoId,
            file,
            url: URL.createObjectURL(file),
            state: "ready",
          })),
        );
        setStep(Math.min(draft.step || 0, 2));
        setQueued(Boolean(draft.queued));
        setRestored(true);
      } else {
        const preset = search.get("category");
        if (categories.includes(preset)) setCategory(preset);
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Autosave every change to this device.
  useEffect(() => {
    if (!ready || sent.current) return;
    const timer = setTimeout(() => {
      saveDraft({
        step,
        category,
        city,
        position,
        description,
        anonymous,
        email,
        queued,
        photos: photos.filter((p) => p.state === "ready").map((p) => p.file),
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [ready, step, category, city, position, description, anonymous, email, queued, photos]);

  const dirty = Boolean(category || description || photos.length || position);
  useEffect(() => {
    const warn = (event) => {
      if (dirty && !sent.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Browser Back moves between steps instead of leaving the flow.
  useEffect(() => {
    const pop = (event) => {
      const value = event.state?.reportStep;
      if (Number.isInteger(value)) startTransition(() => setStep(value));
    };
    history.replaceState({ ...history.state, reportStep: step }, "");
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (ready) heading.current?.focus({ preventScroll: false });
  }, [step]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const selectedCity = options.cities.find((item) => item.code === city);
  const cityName = selectedCity ? localizedCityName(selectedCity.name, locale) : "";
  const center = selectedCity ? [selectedCity.latitude, selectedCity.longitude] : [42.6629, 21.1655];
  // The municipality's official boundary, once loaded. The server checks the same file.
  const [boundary, setBoundary] = useState(null);
  useEffect(() => {
    setBoundary(null);
    if (!selectedCity) return;
    let alive = true;
    fetch(`/boundaries/${selectedCity.code}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((feature) => alive && setBoundary(feature))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [selectedCity?.code]);
  const outside =
    selectedCity &&
    validPoint(position) &&
    (boundary ? !insideBoundary(boundary, position) : distanceKm(position, center) > CITY_RADIUS_KM);
  const outline = useMemo(() => (boundary ? boundaryOutline(boundary) : null), [boundary]);
  const notRouted =
    options.status === "ready" && selectedCity && category && !selectedCity.categories.includes(category);

  function validate(forStep) {
    const next = {};
    if (forStep >= 0 && !category) next.category = t("errors.category");
    if (forStep >= 1) {
      if (!selectedCity) next.municipality = t("errors.municipality");
      else if (notRouted) next.municipality = t("details.notRouted");
      if (!validPoint(position)) next.pin = t("errors.pin");
      else if (outside) next.pin = t("errors.outside");
      const length = description.trim().length;
      if (length < 10) next.description = t("errors.descriptionShort");
      else if (length > 5000) next.description = t("errors.descriptionLong");
    }
    if (forStep >= 2 && !anonymous) {
      if (!emailPattern.test(email.trim())) next.email = t("errors.email");
      if (!consent) next.consent = t("errors.consent");
    }
    return next;
  }
  // Once someone has tried to continue, errors are recomputed on every render as they fix things.
  // Derived, not stored: storing them from an effect re-rendered in a loop on fast input.
  const errors = checked ? validate(step) : {};

  function go(next) {
    setChecked(false);
    history.pushState({ ...history.state, reportStep: next }, "");
    startTransition(() => setStep(next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function advance() {
    const found = validate(step);
    setChecked(true);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.getElementById("error-summary")?.focus());
      return;
    }
    if (step < 2) go(step + 1);
    else submit();
  }
  function editAt(target, fieldId) {
    go(target);
    setTimeout(() => document.getElementById(fieldId)?.focus(), 450);
  }

  function placePin(point) {
    setPosition(point);
    if (city || !validPoint(point)) return;
    const nearest = options.cities
      .map((item) => ({ item, distance: distanceKm(point, [item.latitude, item.longitude]) }))
      .filter(({ distance }) => distance <= CITY_RADIUS_KM)
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest) setCity(nearest.item.code);
  }
  function locate() {
    if (!navigator.geolocation) {
      setLocating("unavailable");
      return;
    }
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        placePin([coords.latitude, coords.longitude]);
        setLocating("idle");
        try {
          navigator.vibrate?.(10);
        } catch {}
      },
      (error) => setLocating(error.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async function addPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setNotice(t("errors.photos"));
    const accepted = files.slice(0, Math.max(0, room));
    const pending = accepted.map((file) => ({ id: ++photoId, file, url: "", state: "busy" }));
    setPhotos((current) => [...current, ...pending]);
    for (const item of pending) {
      try {
        const file = await preparePhoto(item.file);
        setPhotos((current) =>
          current.map((p) =>
            p.id === item.id ? { ...p, file, url: URL.createObjectURL(file), state: "ready" } : p,
          ),
        );
      } catch {
        setNotice(t("details.photoFailed"));
        setPhotos((current) => current.filter((p) => p.id !== item.id));
      }
    }
  }
  function removePhoto(id) {
    setPhotos((current) => {
      const gone = current.find((p) => p.id === id);
      if (gone?.url) URL.revokeObjectURL(gone.url);
      return current.filter((p) => p.id !== id);
    });
  }
  function movePhoto(index, delta) {
    setPhotos((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit() {
    if (sending.current) return;
    if (!navigator.onLine) {
      setQueued(true);
      return;
    }
    sending.current = true;
    setBusy(true);
    setNotice("");
    const form = new FormData();
    Object.entries({
      city,
      category,
      description: description.trim(),
      latitude: position[0],
      longitude: position[1],
      anonymous: String(anonymous),
      language: locale,
    }).forEach(([key, value]) => form.set(key, value));
    if (!anonymous) form.set("email", email.trim());
    photos.filter((p) => p.state === "ready").forEach((p) => form.append("images", p.file));
    try {
      const response = await fetch("/api/reports/submit", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(response.status >= 500 ? t("errors.server") : t("errors.submit"));
        return;
      }
      sent.current = true;
      keepReceipt({
        ...data,
        category,
        city,
        cityName,
        position,
        description: description.trim(),
        photoCount: photos.length,
        anonymous,
        submittedAt: Date.now(),
      });
      await clearDraft();
      setQueued(false);
      router.push("/report/sent");
    } catch {
      // Offline: queue it and send when the connection returns. Online but failing: say so, don't loop.
      if (!navigator.onLine) setQueued(true);
      else setNotice(t("errors.server"));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  // Send a queued report when the connection comes back (or when a queued draft is restored online).
  useEffect(() => {
    if (!queued || !online || !ready) return;
    setNotice(t("offline.sendingQueued"));
    submit();
  }, [online, ready]);

  async function discard() {
    await clearDraft();
    photos.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    setCategory("");
    setPosition(null);
    setDescription("");
    setPhotos([]);
    setAnonymous(true);
    setEmail("");
    setConsent(false);
    setQueued(false);
    setRestored(false);
    setConfirmDiscard(false);
    go(0);
  }

  const done = [Boolean(category), validPoint(position) && description.trim().length >= 10, false].filter(
    Boolean,
  ).length;
  const readyPhotos = photos.filter((p) => p.state === "ready");
  const receipt = (
    <Receipt
      category={category}
      cityName={cityName}
      cityCode={selectedCity?.code}
      position={validPoint(position) ? position : null}
      description={description.trim()}
      photos={readyPhotos.map((p) => p.url)}
      anonymous={step === 2 ? anonymous : undefined}
      label={t("yourReport")}
    />
  );
  const errorList = Object.entries(errors);
  const describe = (name, hint) =>
    [errors[name] && `${name}-error`, hint].filter(Boolean).join(" ") || undefined;
  const fieldError = (name) =>
    errors[name] && (
      <p id={`${name}-error`} className={field.error}>
        <Icon name="info" className="mt-0.5 size-4 shrink-0" />
        {errors[name]}
      </p>
    );

  return (
    <div className="flex flex-1 flex-col">
      {/* Mobile: the receipt peeks from the top and expands on tap. */}
      <div className="sticky top-0 z-10 bg-paper/95 pt-2 pb-3 shadow-[0_1px_0_var(--color-rule)] lg:hidden">
        <div className={wrap}>
          <button
            type="button"
            onClick={() => setPeekOpen((value) => !value)}
            aria-expanded={peekOpen}
            aria-controls="receipt-peek"
            className="flex w-full items-center gap-3 rounded-md bg-card p-3 text-left shadow-soft"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-sm">
                <b className="font-extrabold">{t("yourReport")}</b>
                <span className="text-pencil">{t("progress", { done })}</span>
              </span>
              <Progress steps={t.raw("steps")} step={step} done={done} compact />
              {category && (
                <span
                  className={`stamp-in mt-2 inline-flex -rotate-2 items-center gap-1.5 rounded-sm border-[1.5px] border-current/45 px-2 py-1 text-sm font-extrabold ${categoryStyle[category].text} ${categoryStyle[category].tint}`}
                >
                  <Icon name={category} className="size-5" />
                  {tc(`${category}.name`)}
                </span>
              )}
            </span>
            <span className="text-sm font-bold text-blue">{peekOpen ? t("collapse") : t("expand")}</span>
          </button>
          <div id="receipt-peek" hidden={!peekOpen} className="mt-3 flex justify-center">
            {peekOpen && receipt}
          </div>
        </div>
      </div>

      <div className={`${wrap} grid flex-1 gap-10 pt-6 pb-36 lg:grid-cols-[minmax(0,1fr)_27.5rem] lg:gap-14 lg:pt-10 lg:pb-16`}>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            advance();
          }}
          className="min-w-0"
        >
          <nav aria-label={t("title")} className="hidden lg:block">
            <Progress steps={t.raw("steps")} step={step} done={done} />
          </nav>

          {!online && (
            <p role="status" className="mt-4 flex items-start gap-2 rounded-md bg-wash p-3 text-sm font-semibold">
              <Icon name="info" className="mt-0.5 size-5 shrink-0 text-blue" />
              {t("offline.banner")}
            </p>
          )}
          {restored && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-wash p-3 text-sm">
              <span className="flex-1 font-semibold">{t("draft.restored")}</span>
              <button type="button" onClick={() => setConfirmDiscard(true)} className={btn.link}>
                {t("draft.discard")}
              </button>
            </div>
          )}

          {errorList.length > 0 && (
            <div
              id="error-summary"
              tabIndex={-1}
              role="alert"
              className="mt-5 rounded-md border-[1.5px] border-error bg-error-wash p-4 outline-none focus-visible:outline-3"
            >
              <p className="font-extrabold text-error">{t("errors.summary")}</p>
              <ul className="mt-2 grid gap-1">
                {errorList.map(([name, message]) => (
                  <li key={name}>
                    <a href={`#field-${name}`} className="font-semibold text-ink underline underline-offset-4">
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ViewTransition>
            <div key={step} className="mt-6">
              <p className="text-sm font-bold text-pencil">{t("stepOf", { current: step + 1, total: 3 })}</p>
              <h1
                ref={heading}
                tabIndex={-1}
                className="mt-1 text-3xl font-extrabold tracking-[-0.025em] outline-none"
              >
                {[t("category.heading"), t("details.heading"), t("review.heading")][step]}
              </h1>
              {step === 0 && <p className="mt-2 text-lg text-pencil">{t("category.sub")}</p>}
              {step === 2 && <p className="mt-2 text-lg text-pencil">{t("review.sub")}</p>}

              {step === 0 && (
                <fieldset className="mt-6" id="field-category" aria-describedby={describe("category")}>
                  <legend className="sr-only">{t("category.heading")}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {categories.map((value) => {
                      const style = categoryStyle[value];
                      return (
                        <label
                          key={value}
                          className={`group flex min-h-18 cursor-pointer items-center gap-3 rounded-md border-[1.5px] bg-card p-3 transition-colors duration-120 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue ${category === value ? `${style.border} ${style.tint}` : "border-rule hover:border-pencil"}`}
                        >
                          <input
                            type="radio"
                            name="category"
                            value={value}
                            checked={category === value}
                            onChange={() => {
                              setCategory(value);
                              try {
                                navigator.vibrate?.(8);
                              } catch {}
                            }}
                            className="sr-only"
                          />
                          <span className={`flex size-12 shrink-0 items-center justify-center rounded-sm ${style.text} ${style.tint}`}>
                            <Icon name={value} className="size-7" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-lg leading-tight font-extrabold">{tc(`${value}.name`)}</span>
                            <span className="mt-0.5 block text-sm text-pencil">{tc(`${value}.short`)}</span>
                          </span>
                          {category === value && <Icon name="check" className={`size-6 shrink-0 ${style.text}`} />}
                        </label>
                      );
                    })}
                  </div>
                  {fieldError("category")}
                </fieldset>
              )}

              {step === 1 && (
                <div className="mt-6 grid gap-8">
                  {options.status === "error" && (
                    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-error-wash p-4 text-sm font-semibold">
                      <span className="flex-1">{t("details.optionsError")}</span>
                      <button type="button" onClick={loadOptions} className={btn.link}>
                        <Icon name="refresh" className="size-5" />
                        {t("details.retry")}
                      </button>
                    </div>
                  )}
                  {options.cities.length > 1 && (
                    <label className={field.label} htmlFor="field-municipality">
                      {t("details.municipality")}
                      <select
                        id="field-municipality"
                        className={field.input}
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                        aria-invalid={Boolean(errors.municipality)}
                        aria-describedby={describe("municipality")}
                        autoComplete="address-level2"
                      >
                        <option value="">{t("details.chooseMunicipality")}</option>
                        {options.cities.map((item) => (
                          <option key={item.code} value={item.code}>
                            {localizedCityName(item.name, locale)}
                          </option>
                        ))}
                      </select>
                      {fieldError("municipality")}
                    </label>
                  )}
                  {options.cities.length <= 1 && fieldError("municipality")}
                  {notRouted && !errors.municipality && (
                    <p role="status" className="rounded-md bg-wash p-3 text-sm font-semibold">
                      {t("details.notRouted")}
                    </p>
                  )}

                  <section aria-labelledby="place-label" id="field-pin">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <h2 id="place-label" className="text-xl font-extrabold">
                        {t("details.location")}
                        {cityName && <span className="ml-2 text-base font-semibold text-pencil">{cityName}</span>}
                      </h2>
                      <button
                        type="button"
                        onClick={locate}
                        disabled={locating === "busy"}
                        className={`${btn.soft} min-h-12 w-full px-4 text-base sm:w-auto`}
                      >
                        <Icon name="locate" className="size-5" />
                        {locating === "busy" ? t("details.locating") : t("details.useLocation")}
                      </button>
                    </div>
                    <p id="map-hint" className="mt-2 text-sm text-pencil">
                      {t("details.mapHint")}
                    </p>
                    {(locating === "denied" || locating === "unavailable") && (
                      <p role="status" className="mt-3 flex items-start gap-2 rounded-md bg-wash p-3 text-sm font-semibold">
                        <Icon name="info" className="mt-0.5 size-5 shrink-0 text-blue" />
                        {locating === "denied" ? t("details.locationDenied") : t("details.locationUnavailable")}
                      </p>
                    )}
                    <div className="-mx-[max(1rem,env(safe-area-inset-left))] mt-4 overflow-hidden sm:mx-0 sm:rounded-md sm:shadow-[0_0_0_1px_var(--color-rule)]">
                      <ReportMap
                        center={center}
                        zoom={selectedCity?.zoom || 13}
                        position={validPoint(position) ? position : null}
                        onChange={placePin}
                        label={t("details.location")}
                        pinLabel={validPoint(position) ? formatCoords(position) : ""}
                        onTileError={() => setTileError(true)}
                        outline={outline}
                      />
                    </div>
                    {/* For anyone who finds pointing at a map hard: one big button under it. */}
                    <div className="mt-3 flex flex-col gap-3 rounded-md bg-wash p-4 sm:flex-row sm:items-center">
                      <p className="flex-1 text-sm font-semibold">{t("details.mapHelp")}</p>
                      <button
                        type="button"
                        onClick={locate}
                        disabled={locating === "busy"}
                        className={`${btn.primary} w-full sm:w-auto`}
                      >
                        <Icon name="locate" className="size-5" />
                        {locating === "busy" ? t("details.locating") : t("details.locateMe")}
                      </button>
                    </div>
                    <p aria-live="polite" className="tabular mt-3 min-h-6 text-sm font-semibold">
                      {validPoint(position) && t("details.pinPlaced", { coords: formatCoords(position) })}
                    </p>
                    {outside && (
                      <p role="status" className="mt-1 rounded-md bg-wash p-3 text-sm font-semibold">
                        {t("details.outside", { city: cityName })}
                      </p>
                    )}
                    {tileError && <p role="status" className="mt-2 text-sm font-semibold">{t("details.mapError")}</p>}
                    {fieldError("pin")}
                    <details className="mt-3" open={tileError || undefined}>
                      <summary className="min-h-11 cursor-pointer py-2 font-bold text-blue">{t("details.coordinates")}</summary>
                      <div className="grid grid-cols-2 gap-3">
                        {["latitude", "longitude"].map((name, index) => (
                          <CoordinateInput
                            key={name}
                            id={`field-${name}`}
                            label={t(`details.${name}`)}
                            value={position?.[index]}
                            onChange={(number) => {
                              const next = position ? [...position] : [NaN, NaN];
                              next[index] = number;
                              placePin(next);
                            }}
                          />
                        ))}
                      </div>
                    </details>
                  </section>

                  <div>
                    <label htmlFor="field-description" className={field.label}>
                      {t("details.description")}
                    </label>
                    {category && (
                      <p id="description-hint" className={field.hint}>
                        {tc(`${category}.prompt`)}
                      </p>
                    )}
                    <textarea
                      id="field-description"
                      className={`${field.input} min-h-40 leading-relaxed`}
                      rows={6}
                      maxLength={5000}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      aria-invalid={Boolean(errors.description)}
                      aria-describedby={describe("description", category ? "description-hint description-count" : "description-count")}
                      enterKeyHint="done"
                      autoCapitalize="sentences"
                      spellCheck
                    />
                    <p id="description-count" className="tabular mt-1 text-right text-xs text-pencil">
                      {t("details.count", { count: description.length })}
                    </p>
                    {fieldError("description")}
                  </div>

                  <section aria-labelledby="photos-label" id="field-photos">
                    <h2 id="photos-label" className="text-xl font-extrabold">
                      {t("details.photos")}{" "}
                      <span className="text-base font-semibold text-pencil">({t("details.optional")})</span>
                    </h2>
                    <p className={field.hint}>{t("details.photoLimit")}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className={`${btn.primary} ${photos.length >= MAX_PHOTOS ? "pointer-events-none opacity-50" : ""}`}>
                        <Icon name="camera" className="size-5" />
                        {t("details.takePhoto")}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={addPhotos}
                          className="sr-only"
                          disabled={photos.length >= MAX_PHOTOS}
                        />
                      </label>
                      <label className={`${btn.soft} ${photos.length >= MAX_PHOTOS ? "pointer-events-none opacity-50" : ""}`}>
                        <Icon name="gallery" className="size-5" />
                        {t("details.gallery")}
                        <input
                          type="file"
                          accept={ACCEPTED.join(",")}
                          multiple
                          onChange={addPhotos}
                          className="sr-only"
                          disabled={photos.length >= MAX_PHOTOS}
                        />
                      </label>
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-sm text-pencil">
                      <Icon name="key" className="mt-0.5 size-4 shrink-0" />
                      {t("details.photoPrivacy")}
                    </p>
                    {photos.length > 0 && (
                      <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {photos.map((photo, index) => (
                          <li key={photo.id} className="clip-in overflow-hidden rounded-md bg-card shadow-[0_0_0_1px_var(--color-rule)]">
                            {photo.state === "ready" ? (
                              <img src={photo.url} alt={t("details.photo", { n: index + 1 })} className="aspect-[4/3] w-full object-cover" />
                            ) : (
                              <div className="flex aspect-[4/3] items-center justify-center bg-wash text-sm font-semibold text-pencil" role="status">
                                {t("details.preparing")}
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <button type="button" onClick={() => movePhoto(index, -1)} disabled={index === 0} className="inline-flex size-11 items-center justify-center disabled:opacity-30" aria-label={t("details.moveLeft", { n: index + 1 })}>
                                <Icon name="chevronLeft" className="size-5" />
                              </button>
                              <button type="button" onClick={() => removePhoto(photo.id)} className="inline-flex size-11 items-center justify-center text-error" aria-label={t("details.remove", { n: index + 1 })}>
                                <Icon name="close" className="size-5" />
                              </button>
                              <button type="button" onClick={() => movePhoto(index, 1)} disabled={index === photos.length - 1} className="inline-flex size-11 items-center justify-center disabled:opacity-30" aria-label={t("details.moveRight", { n: index + 1 })}>
                                <Icon name="chevronRight" className="size-5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              )}

              {step === 2 && (
                <div className="mt-6 grid gap-8">
                  <div className="flex justify-center lg:hidden">
                    <Receipt
                      category={category}
                      cityName={cityName}
                      cityCode={selectedCity?.code}
                      position={position}
                      description={description.trim()}
                      photos={readyPhotos.map((p) => p.url)}
                      anonymous={anonymous}
                    />
                  </div>
                  <ul className="grid gap-2">
                    {[
                      ["editCategory", 0, "field-category"],
                      ["editPlace", 1, "field-pin"],
                      ["editDescription", 1, "field-description"],
                      ["editPhotos", 1, "field-photos"],
                    ].map(([key, target, id]) => (
                      <li key={key}>
                        <button type="button" onClick={() => editAt(target, id)} className={btn.link}>
                          {t(`review.${key}`)}
                        </button>
                      </li>
                    ))}
                  </ul>

                  <fieldset>
                    <legend className="text-xl font-extrabold">{t("review.identity")}</legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {[
                        [true, "anonymous", "key"],
                        [false, "named", "share"],
                      ].map(([value, key, icon]) => (
                        <label
                          key={key}
                          className={`flex cursor-pointer gap-3 rounded-md border-[1.5px] p-4 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue ${anonymous === value ? "border-blue bg-wash" : "border-rule bg-card hover:border-pencil"}`}
                        >
                          <input
                            type="radio"
                            name="identity"
                            checked={anonymous === value}
                            onChange={() => setAnonymous(value)}
                            className="mt-1 size-5 shrink-0 accent-[var(--color-blue)]"
                          />
                          <span>
                            <span className="flex items-center gap-2 text-lg font-extrabold">
                              <Icon name={icon} className="size-5 text-blue" />
                              {t(`review.${key}`)}
                            </span>
                            <span className="mt-1 block text-sm text-pencil">{t(`review.${key}Body`)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {!anonymous && (
                    <div className="grid gap-4">
                      <label htmlFor="field-email" className={field.label}>
                        {t("review.email")}
                        <input
                          id="field-email"
                          className={field.input}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          enterKeyHint="send"
                          maxLength={254}
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={describe("email")}
                        />
                        {fieldError("email")}
                      </label>
                      <div id="field-consent">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(event) => setConsent(event.target.checked)}
                            className="mt-0.5 size-6 shrink-0 accent-[var(--color-blue)]"
                            aria-invalid={Boolean(errors.consent)}
                            aria-describedby={describe("consent")}
                          />
                          <span>{t("review.consent")}</span>
                        </label>
                        {fieldError("consent")}
                      </div>
                    </div>
                  )}

                  <p className="flex items-start gap-2.5 rounded-md bg-wash p-4 text-sm">
                    <Icon name="info" className="mt-0.5 size-5 shrink-0 text-blue" />
                    {t("review.disclaimer")}
                  </p>
                </div>
              )}
            </div>
          </ViewTransition>

          <div aria-live="polite" className="mt-4">
            {notice && <p className="rounded-md bg-wash p-3 text-sm font-semibold">{notice}</p>}
            {queued && !online && <p className="rounded-md bg-wash p-3 text-sm font-semibold">{t("offline.queued")}</p>}
          </div>

          {/* Back and Continue sit in the thumb zone on phones. */}
          <div className="fixed inset-x-0 bottom-0 z-20 bg-paper/95 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-1px_0_var(--color-rule)] lg:static lg:mt-8 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className={`${wrap} grid grid-cols-[auto_1fr] gap-2 lg:max-w-none lg:px-0`}>
              {step > 0 ? (
                <button type="button" onClick={() => go(step - 1)} className={`${btn.soft} px-4`} disabled={busy}>
                  <Icon name="back" className="size-5" />
                  {t("back")}
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className={btn.primary} disabled={busy || !ready}>
                {step < 2 ? t("next") : busy ? t("review.sending") : t("review.submit")}
              </button>
            </div>
          </div>
        </form>

        <aside className="hidden lg:block" aria-label={t("yourReport")}>
          <div className="sticky top-6 rotate-[-1.5deg]">{receipt}</div>
        </aside>
      </div>

      <Sheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={t("draft.confirmTitle")}
        titleId="discard-title"
        closeLabel={t("draft.confirmNo")}
        center
      >
        <p className="mt-2 text-pencil">{t("draft.confirmBody")}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={discard} className={`${btn.primary} bg-error hover:bg-error`}>
            {t("draft.confirmYes")}
          </button>
          <button type="button" onClick={() => setConfirmDiscard(false)} className={btn.soft}>
            {t("draft.confirmNo")}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

// Keeps what the person typed ("42.", "42,66") as text, and only reports a number when it parses.
// It follows the map when the pin moves there.
function CoordinateInput({ id, label, value, onChange }) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  useEffect(() => {
    const typed = Number(text.replace(",", "."));
    if (Number.isFinite(value) && (text === "" || Math.abs(typed - value) > 1e-9))
      setText(value.toFixed(6));
    if (value === undefined) setText("");
  }, [value]);
  return (
    <label className="text-sm font-bold" htmlFor={id}>
      {label}
      <input
        id={id}
        className={`${field.input} tabular`}
        type="text"
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          const normalized = raw.replace(",", ".").trim();
          onChange(normalized === "" || !/^-?\d+(\.\d*)?$/.test(normalized) ? NaN : Number(normalized));
        }}
      />
    </label>
  );
}

function Progress({ steps, step, done, compact = false }) {
  return (
    <ol className={`grid grid-cols-3 gap-1.5 ${compact ? "mt-2" : ""}`}>
      {steps.map((label, index) => (
        <li key={label} aria-current={index === step ? "step" : undefined} className="min-w-0">
          <span
            className={`block h-1.5 rounded-full ${index < done || index < step ? "bg-blue" : index === step ? "bg-blue/45" : "bg-wash"}`}
          />
          {!compact && (
            <span className={`mt-2 block truncate text-sm ${index === step ? "font-extrabold text-ink" : "font-semibold text-pencil"}`}>
              {label}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
