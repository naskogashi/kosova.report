"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Construction,
  Download,
  Droplets,
  Folder,
  GraduationCap,
  HeartPulse,
  Leaf,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { categories } from "../../lib/report-options";
import { siteTitle } from "../../lib/site-branding";

const ReportMap = dynamic(() => import("../../components/ReportMap"), {
  ssr: false,
  loading: () => <div className="h-[340px] animate-pulse bg-slate-100" />,
});
const categoryIcons = [
  Construction,
  Leaf,
  Droplets,
  Folder,
  HeartPulse,
  GraduationCap,
  ShieldCheck,
];
const translations = {
  sq: {
    title: "Raporto një problem",
    intro: "Ndihmo të ndërtojmë një Kosovë më të mirë.",
    steps: ["Kategoria", "Detajet", "Dërgo"],
    heading: [
      "Zgjidhni kategorinë e problemit",
      "Përshkruani problemin",
      "Rishiko dhe dërgo",
    ],
    subtitle: [
      "Zgjidhni fushën përkatëse të raportimit.",
      "Vendosni detajet dhe vendndodhjen e saktë.",
      "Kontrolloni të dhënat para dërgimit.",
    ],
    categories: [
      "Infrastrukturë",
      "Mjedis",
      "Shërbime publike",
      "Administratë",
      "Shëndetësi",
      "Arsim",
      "Siguri",
    ],
    city: "Komuna",
    choose: "Zgjidhni komunën",
    description: "Përshkrimi",
    descriptionHint: "Çfarë ka ndodhur? Shkruani të paktën 10 karaktere.",
    location: "Lokacioni",
    pin: "Prekni hartën për të vendosur shenjën ose shkruani koordinatat.",
    upload: "Ngarko dëshmi",
    uploadHint: "Mund të ngarkohen deri në 10 skedarë",
    fileLimit: "JPEG, PNG ose WebP · maksimumi 5 MB secili",
    next: "Vazhdo",
    back: "Prapa",
    anonymous: "Dërgo në mënyrë anonime",
    anonymousHint: "Raportoni pa dhënë të dhëna kontakti.",
    email: "Email i raportuesit",
    emailHint: "Emaili juaj i dërgohet vetëm departamentit përgjegjës.",
    submit: "Dërgo raportin",
    sending: "Duke dërguar…",
    privacy: "Raporti juaj do t’i dërgohet departamentit përgjegjës.",
    saved: "Raporti juaj është dërguar!",
    receipt: "Numri i raportit",
    tracking: "Ruajeni këtë çelës privat për të marrë kopjen e raportit.",
    pdf: "Shkarko kopjen e raportit (PDF)",
    another: "Raporto tjetër",
    error: "Kontrolloni të dhënat dhe provoni përsëri.",
    detailsError:
      "Zgjidhni komunën, vendosni shenjën brenda zonës së Kosovës dhe shkruani 10–5000 karaktere.",
    pdfError: "PDF-ja nuk u shkarkua. Provoni përsëri.",
    pending: "Raporti u ruajt. Njoftimi i departamentit është në pritje.",
    photos: "Dëshmi",
    remove: "Hiq fotografinë",
    loading: "Duke përgatitur…",
  },
  sr: {
    title: "Prijavite problem",
    intro: "Pomozite da izgradimo bolje Kosovo.",
    steps: ["Kategorija", "Detalji", "Pošalji"],
    heading: [
      "Izaberite kategoriju problema",
      "Opišite problem",
      "Pregledajte i pošaljite",
    ],
    subtitle: [
      "Izaberite odgovarajuću oblast prijave.",
      "Unesite detalje i tačnu lokaciju.",
      "Proverite podatke pre slanja.",
    ],
    categories: [
      "Infrastruktura",
      "Životna sredina",
      "Javne usluge",
      "Administracija",
      "Zdravstvo",
      "Obrazovanje",
      "Bezbednost",
    ],
    city: "Opština",
    choose: "Izaberite opštinu",
    description: "Opis",
    descriptionHint: "Šta se dogodilo? Unesite najmanje 10 znakova.",
    location: "Lokacija",
    pin: "Dodirnite mapu da postavite oznaku ili unesite koordinate.",
    upload: "Otpremite dokaze",
    uploadHint: "Možete otpremiti do 10 datoteka",
    fileLimit: "JPEG, PNG ili WebP · najviše 5 MB po datoteci",
    next: "Dalje",
    back: "Nazad",
    anonymous: "Pošaljite anonimno",
    anonymousHint: "Prijavite bez kontakt podataka.",
    email: "Email podnosioca",
    emailHint: "Vaš email se šalje samo nadležnom odeljenju.",
    submit: "Pošaljite prijavu",
    sending: "Slanje…",
    privacy: "Vaša prijava će biti poslata nadležnom odeljenju.",
    saved: "Vaša prijava je poslata!",
    receipt: "Broj prijave",
    tracking: "Sačuvajte ovaj privatni ključ za preuzimanje kopije prijave.",
    pdf: "Preuzmite kopiju prijave (PDF)",
    another: "Prijavite drugi problem",
    error: "Proverite podatke i pokušajte ponovo.",
    detailsError:
      "Izaberite opštinu, postavite oznaku u oblasti Kosova i unesite 10–5000 znakova.",
    pdfError: "Preuzimanje PDF-a nije uspelo. Pokušajte ponovo.",
    pending: "Prijava je sačuvana. Obaveštenje odeljenju je na čekanju.",
    photos: "Dokazi",
    remove: "Ukloni fotografiju",
    loading: "Priprema…",
  },
  en: {
    title: "Report a problem",
    intro: "Help us build a better Kosovo.",
    steps: ["Category", "Details", "Submit"],
    heading: [
      "Choose a problem category",
      "Describe the problem",
      "Review and submit",
    ],
    subtitle: [
      "Choose the area that best fits your report.",
      "Add details and the exact location.",
      "Check your information before submitting.",
    ],
    categories: [
      "Infrastructure",
      "Environment",
      "Public services",
      "Administration",
      "Health",
      "Education",
      "Safety",
    ],
    city: "Municipality",
    choose: "Choose a municipality",
    description: "Description",
    descriptionHint: "What happened? Enter at least 10 characters.",
    location: "Location",
    pin: "Tap the map to drop a pin, or enter coordinates.",
    upload: "Upload evidence",
    uploadHint: "You can upload up to 10 files",
    fileLimit: "JPEG, PNG or WebP · maximum 5 MB each",
    next: "Continue",
    back: "Back",
    anonymous: "Submit anonymously",
    anonymousHint: "Report without providing contact details.",
    email: "Reporter email",
    emailHint: "Your email is shared only with the assigned department.",
    submit: "Submit report",
    sending: "Submitting…",
    privacy: "Your report will be sent to the responsible department.",
    saved: "Your report has been submitted!",
    receipt: "Report number",
    tracking: "Save this private key to download your report receipt.",
    pdf: "Download copy of report (PDF)",
    another: "Report another problem",
    error: "Check your information and try again.",
    detailsError:
      "Choose a municipality, place a pin in the Kosovo area and enter 10–5000 characters.",
    pdfError: "PDF download failed. Please try again.",
    pending: "Report saved. Department notification is pending.",
    photos: "Evidence",
    remove: "Remove photo",
    loading: "Preparing…",
  },
};
const inputClass =
  "mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
const primaryClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#0843b5] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50";

export default function Home() {
  const [municipalities, setMunicipalities] = useState([]);
  const [optionsState, setOptionsState] = useState("loading");
  const [language, setLanguage] = useState("sq");
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [position, setPosition] = useState(null);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [anonymous, setAnonymous] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const submissionLock = useRef(false);
  const heading = useRef(null);
  const optionMessages = {
    sq: "Raportimi për këtë kategori nuk është konfiguruar ende. Ju lutemi provoni më vonë.",
    sr: "Prijavljivanje za ovu kategoriju još nije podešeno. Pokušajte kasnije.",
    en: "Reporting for this category is not configured yet. Please try again later.",
  };
  const t = translations[language];
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/report-options", { signal: abort.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        setMunicipalities(data.cities);
        if (data.cities.length === 1) setCity(data.cities[0].code);
        setOptionsState("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setOptionsState("error");
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    function sync() {
      const value = new URLSearchParams(window.location.search).get("lang");
      setLanguage(Object.hasOwn(translations, value) ? value : "sq");
    }
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = siteTitle(language);
  }, [language]);
  useEffect(() => {
    const urls = images.map((image) => URL.createObjectURL(image));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);
  useEffect(() => {
    heading.current?.focus();
  }, [step, result]);
  function changeLanguage(value) {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", value);
    window.history.pushState({}, "", url);
    setLanguage(value);
    setError("");
  }
  function advance(event) {
    event.preventDefault();
    if (step === 0 && !category) return;
    if (
      step === 1 &&
      (!municipalities.some(
        (item) => item.code === city && item.categories.includes(category),
      ) ||
        !position ||
        !position.every(Number.isFinite) ||
        position[0] < -90 ||
        position[0] > 90 ||
        position[1] < -180 ||
        position[1] > 180 ||
        description.trim().length < 10 ||
        description.trim().length > 5000)
    ) {
      setError(t.detailsError);
      return;
    }
    setError("");
    setStep((value) => value + 1);
  }
  function addImages(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (
      images.length + selected.length > 10 ||
      selected.some(
        (file) =>
          !file.size ||
          file.size > 5 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      setError(`${t.uploadHint}. ${t.fileLimit}`);
      return;
    }
    setImages((current) => [...current, ...selected]);
    setError("");
  }
  async function submit(event) {
    event.preventDefault();
    if (submissionLock.current || step !== 2) return;
    submissionLock.current = true;
    setBusy(true);
    setError("");
    const form = new FormData();
    Object.entries({
      city,
      category,
      description,
      latitude: position[0],
      longitude: position[1],
      anonymous: String(anonymous),
      language,
    }).forEach(([key, value]) => form.set(key, value));
    if (!anonymous) form.set("email", email);
    images.forEach((image) => form.append("images", image));
    try {
      const response = await fetch("/api/reports/submit", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setResult(data);
    } catch {
      setError(t.error);
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }
  async function downloadPDF() {
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(result.public_id)}/pdf`,
        {
          headers: { Authorization: `Bearer ${result.tracking_key}` },
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.public_id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setError(t.pdfError);
    } finally {
      setDownloading(false);
    }
  }
  function reset() {
    setResult(null);
    setStep(0);
    setCategory("");
    setCity("");
    setPosition(null);
    setDescription("");
    setImages([]);
    setAnonymous(true);
    setEmail("");
    setError("");
  }
  return (
    <>
      <header className="sticky top-0 z-20 bg-[#062653] text-white shadow-sm">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <a
            href={`/?lang=${language}`}
            aria-label="kosova.report"
            className="text-xl font-bold tracking-tight"
          >
            kosova<span className="text-amber-300">.</span>report
          </a>
          <nav aria-label="Language" className="flex gap-1">
            {["sq", "sr", "en"].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeLanguage(value)}
                aria-pressed={language === value}
                className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${language === value ? "bg-white/15 ring-1 ring-white/30" : "hover:bg-white/10"}`}
              >
                {value.toUpperCase()}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl px-3 py-5 sm:px-6 sm:py-10">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {result ? (
            <section
              className="space-y-6 px-5 py-10 text-center sm:px-10"
              aria-live="polite"
            >
              <CheckCircle2
                size={72}
                aria-hidden="true"
                className="mx-auto text-emerald-600"
              />
              <h1
                tabIndex={-1}
                ref={heading}
                className="text-2xl font-bold text-[#102344] outline-none"
              >
                {t.saved}
              </h1>
              <div>
                <p className="mb-2 text-sm text-slate-600">{t.receipt}</p>
                <p className="inline-block rounded-lg bg-blue-50 px-5 py-3 text-xl font-bold text-[#102344]">
                  {result.public_id}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-left">
                <p className="mb-3 text-sm text-slate-600">{t.tracking}</p>
                <code className="block break-all text-sm">
                  {result.tracking_key}
                </code>
              </div>
              {result.notification === "pending" && (
                <p className="text-sm text-amber-800">{t.pending}</p>
              )}
              <button
                type="button"
                disabled={downloading}
                onClick={downloadPDF}
                className={`${primaryClass} w-full`}
              >
                <Download size={18} />
                {downloading ? t.loading : t.pdf}
              </button>
              <button
                type="button"
                onClick={reset}
                className="min-h-12 text-sm font-semibold text-blue-800"
              >
                {t.another}
              </button>
            </section>
          ) : (
            <>
              <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  kosova.report
                </p>
                <h1 className="mt-2 text-xl font-bold text-[#102344]">
                  {t.title}
                </h1>
                <p className="mt-1 text-sm text-slate-500">{t.intro}</p>
              </div>
              <ol className="flex items-center px-5 py-6 sm:px-8">
                {t.steps.map((label, index) => (
                  <li
                    key={label}
                    aria-current={step === index ? "step" : undefined}
                    className={`flex min-w-0 flex-1 items-center text-[11px] sm:text-xs ${index <= step ? "text-blue-800" : "text-slate-500"}`}
                  >
                    <span
                      className={`mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${index <= step ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300"}`}
                    >
                      {index < step ? <Check size={13} /> : index + 1}
                    </span>
                    <span>{label}</span>
                    {index < 2 && (
                      <span className="mx-2 h-px min-w-2 flex-1 bg-slate-200" />
                    )}
                  </li>
                ))}
              </ol>
              <form onSubmit={submit} className="px-5 pb-6 sm:px-8">
                <fieldset disabled={busy} className="min-w-0 space-y-5">
                  <legend className="sr-only">{t.heading[step]}</legend>
                  <div>
                    <h2
                      ref={heading}
                      tabIndex={-1}
                      className="text-lg font-bold text-[#102344] outline-none"
                    >
                      {t.heading[step]}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {t.subtitle[step]}
                    </p>
                  </div>
                  {step === 0 && (
                    <div
                      role="radiogroup"
                      aria-label={t.steps[0]}
                      className="space-y-2"
                    >
                      {categories.map((value, index) => {
                        const Icon = categoryIcons[index];
                        return (
                          <label
                            key={value}
                            className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition ${category === value ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 hover:bg-slate-50"}`}
                          >
                            <input
                              type="radio"
                              name="category"
                              value={value}
                              checked={category === value}
                              onChange={() => setCategory(value)}
                              className="sr-only peer"
                            />
                            <span className="rounded-lg bg-slate-100 p-2.5 text-blue-800 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500">
                              <Icon size={23} aria-hidden="true" />
                            </span>
                            <span className="flex-1 text-sm font-semibold">
                              {t.categories[index]}
                            </span>
                            {category === value ? (
                              <CheckCircle2
                                size={20}
                                className="text-blue-700"
                              />
                            ) : (
                              <ChevronRight
                                size={18}
                                className="text-slate-400"
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {step === 1 && (
                    <>
                      <label className="block text-sm font-semibold">
                        {t.city}
                        <span className="text-red-600"> *</span>
                        {(optionsState === "error" ||
                          (optionsState === "ready" &&
                            !municipalities.some(
                              (item) =>
                                item.code === city &&
                                item.categories.includes(category),
                            ))) && (
                          <span
                            role="status"
                            className="mt-2 block rounded-lg bg-amber-50 p-3 text-xs font-normal text-amber-900"
                          >
                            {optionMessages[language]}
                          </span>
                        )}
                        <select
                          className={inputClass}
                          value={city}
                          onChange={(event) => {
                            setCity(event.target.value);
                            setPosition(null);
                          }}
                        >
                          <option value="">{t.choose}</option>
                          {municipalities.map((value) => (
                            <option key={value.code} value={value.code}>
                              {value.name}{" "}
                              {value.country ? `· ${value.country}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-semibold">
                        {t.description}
                        <span className="text-red-600"> *</span>
                        <textarea
                          className={inputClass}
                          rows={5}
                          maxLength={5000}
                          value={description}
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
                          placeholder={t.descriptionHint}
                        />
                        <span className="mt-1 block text-right text-xs font-normal text-slate-500">
                          {description.length}/5000
                        </span>
                      </label>
                      <section aria-label={t.location}>
                        <h3 className="text-sm font-semibold">
                          {t.location}
                          <span className="text-red-600"> *</span>
                        </h3>
                        <p className="mb-3 mt-1 text-xs text-slate-500">
                          {t.pin}
                        </p>
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                          <ReportMap
                            center={[
                              municipalities.find((item) => item.code === city)
                                ?.latitude || 42.6629,
                              municipalities.find((item) => item.code === city)
                                ?.longitude || 21.1655,
                            ]}
                            zoom={
                              municipalities.find((item) => item.code === city)
                                ?.zoom || 13
                            }
                            language={language}
                            position={position}
                            onChange={setPosition}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {["Latitude", "Longitude"].map((label, index) => (
                            <label key={label} className="text-xs font-medium">
                              {label}
                              <input
                                className={inputClass}
                                type="number"
                                step="any"
                                min={index ? -180 : -90}
                                max={index ? 180 : 90}
                                value={
                                  Number.isFinite(position?.[index])
                                    ? position[index]
                                    : ""
                                }
                                onChange={(event) => {
                                  const updated = position
                                    ? [...position]
                                    : [NaN, NaN];
                                  updated[index] =
                                    event.target.value === ""
                                      ? NaN
                                      : Number(event.target.value);
                                  setPosition(updated);
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      </section>
                      <div>
                        <label
                          htmlFor="images"
                          className="mb-2 block text-sm font-semibold"
                        >
                          {t.upload}
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                          <Upload
                            size={22}
                            className="shrink-0 text-blue-700"
                          />
                          <span className="min-w-0 flex-1 text-xs text-slate-600">
                            {t.uploadHint}
                            <span className="mt-1 block">{t.fileLimit}</span>
                            <input
                              id="images"
                              type="file"
                              multiple
                              accept="image/jpeg,image/png,image/webp"
                              onChange={addImages}
                              className="mt-3 block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:text-blue-900"
                            />
                          </span>
                        </label>
                        {images.length > 0 && (
                          <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                            {images.map((image, index) => (
                              <li
                                key={`${image.name}-${index}`}
                                className="relative"
                              >
                                <img
                                  src={previews[index]}
                                  alt={image.name}
                                  className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                                />
                                <button
                                  type="button"
                                  aria-label={`${t.remove}: ${image.name}`}
                                  onClick={() =>
                                    setImages((current) =>
                                      current.filter((_, i) => i !== index),
                                    )
                                  }
                                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-800 shadow"
                                >
                                  <X size={16} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <dl className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm">
                        {[
                          [
                            t.steps[0],
                            t.categories[categories.indexOf(category)],
                          ],
                          [
                            t.city,
                            municipalities.find((item) => item.code === city)
                              ?.name,
                          ],
                          [
                            t.location,
                            position
                              .map((value) => value.toFixed(6))
                              .join(", "),
                          ],
                          [t.description, description],
                          [t.photos, `${images.length} / 10`],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 sm:grid-cols-[120px_minmax(0,1fr)]"
                          >
                            <dt className="text-xs font-semibold text-slate-500">
                              {label}
                            </dt>
                            <dd className="whitespace-pre-wrap break-words">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {images.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                          {images.map((image, index) => (
                            <img
                              key={index}
                              src={previews[index]}
                              alt={image.name}
                              className="aspect-square w-full rounded-lg object-cover"
                            />
                          ))}
                        </div>
                      )}
                      <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            className="mt-1 h-5 w-5 accent-blue-700"
                            type="checkbox"
                            checked={anonymous}
                            onChange={(event) =>
                              setAnonymous(event.target.checked)
                            }
                          />
                          <span>
                            <span className="block text-sm font-semibold">
                              {t.anonymous}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {t.anonymousHint}
                            </span>
                          </span>
                        </label>
                        {!anonymous && (
                          <label className="block text-sm font-semibold">
                            {t.email}
                            <input
                              className={inputClass}
                              type="email"
                              required
                              maxLength={254}
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              autoComplete="email"
                            />
                            <span className="mt-2 block text-xs font-normal text-slate-500">
                              {t.emailHint}
                            </span>
                          </label>
                        )}
                      </div>
                    </>
                  )}
                </fieldset>
                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
                  >
                    {error}
                  </p>
                )}
                <div className="mt-7 flex gap-3">
                  {step > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setError("");
                        setStep((value) => value - 1);
                      }}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-blue-900 disabled:opacity-50"
                    >
                      <ArrowLeft size={16} />
                      {t.back}
                    </button>
                  )}
                  {step < 2 ? (
                    <button
                      type="button"
                      disabled={!category}
                      onClick={advance}
                      className={`${primaryClass} flex-1`}
                    >
                      {t.next}
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      className={`${primaryClass} flex-1`}
                      disabled={busy}
                    >
                      {busy ? t.sending : t.submit}
                    </button>
                  )}
                </div>
                {step === 2 && (
                  <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-slate-500">
                    <LockKeyhole size={14} className="mt-0.5 shrink-0" />
                    {t.privacy}
                  </p>
                )}
              </form>
            </>
          )}
          {result && error && (
            <p
              role="alert"
              className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
