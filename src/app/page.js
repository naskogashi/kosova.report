"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Globe2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
} from "lucide-react";
const copy = {
  sq: {
    tag: "Zëri yt. Një qytet më i mirë.",
    title: "Raporto problemin. Ndërto një Kosovë më të mirë.",
    intro:
      "Një mënyrë e thjeshtë për të dokumentuar problemet në komunitet dhe për t’i dërguar te departamenti përgjegjës.",
    start: "Raporto një problem",
    how: "Si funksionon?",
    steps: [
      [
        "Zgjidh kategorinë",
        "Rrugët, mjedisi, shërbimet publike dhe fusha të tjera.",
      ],
      [
        "Trego vendndodhjen",
        "Vendos shenjën në hartë, përshkruaj problemin dhe shto fotografi.",
      ],
      [
        "Dërgo dhe ruaj kopjen",
        "Kontrollo të dhënat, dërgo raportin dhe shkarko dëshminë PDF.",
      ],
    ],
    privacyTitle: "Ti vendos si të raportosh",
    privacy:
      "Raporto në mënyrë anonime ose ndaj emailin tënd me departamentin përgjegjës. Ruaje çelësin privat për të shkarkuar kopjen e raportit.",
    note: "Kjo platformë nuk është shërbim emergjence. Raportimi nuk garanton zgjidhjen e menjëhershme të problemit.",
    admin: "Paneli administrativ",
    label: "Pjesëmarrje qytetare, hap pas hapi",
    receipt: "Dëshmi PDF",
    languages: "Tri gjuhë",
    anonymous: "Raportim anonim",
  },
  sr: {
    tag: "Vaš glas. Bolji grad.",
    title: "Prijavite problem. Izgradimo bolje Kosovo.",
    intro:
      "Jednostavan način da dokumentujete probleme u zajednici i pošaljete ih nadležnom odeljenju.",
    start: "Prijavite problem",
    how: "Kako funkcioniše?",
    steps: [
      [
        "Izaberite kategoriju",
        "Infrastruktura, životna sredina, javne usluge i druge oblasti.",
      ],
      [
        "Označite lokaciju",
        "Postavite oznaku na mapi, opišite problem i dodajte fotografije.",
      ],
      [
        "Pošaljite i sačuvajte kopiju",
        "Proverite podatke, pošaljite prijavu i preuzmite PDF potvrdu.",
      ],
    ],
    privacyTitle: "Vi birate kako ćete prijaviti",
    privacy:
      "Prijavite anonimno ili podelite email sa nadležnim odeljenjem. Sačuvajte privatni ključ za preuzimanje kopije prijave.",
    note: "Ova platforma nije služba za hitne slučajeve. Prijava ne garantuje trenutno rešavanje problema.",
    admin: "Administratorski panel",
    label: "Građansko učešće, korak po korak",
    receipt: "PDF potvrda",
    languages: "Tri jezika",
    anonymous: "Anonimno prijavljivanje",
  },
  en: {
    tag: "Your voice. A better city.",
    title: "Report a problem. Build a better Kosovo.",
    intro:
      "A simple way to document issues in your community and send them to the responsible department.",
    start: "Report a problem",
    how: "How does it work?",
    steps: [
      [
        "Choose a category",
        "Infrastructure, environment, public services and other community issues.",
      ],
      [
        "Mark the location",
        "Drop a map pin, describe the issue and add photos.",
      ],
      [
        "Submit and keep a copy",
        "Review your details, send your report and download a PDF receipt.",
      ],
    ],
    privacyTitle: "You choose how to report",
    privacy:
      "Submit anonymously or share your email with the assigned department. Save your private tracking key to download your report receipt.",
    note: "This platform is not an emergency service. Submitting a report does not guarantee an immediate resolution.",
    admin: "Admin panel",
    label: "Civic participation, one step at a time",
    receipt: "PDF receipt",
    languages: "Three languages",
    anonymous: "Anonymous reporting",
  },
};
export default function Welcome() {
  const [language, setLanguage] = useState("sq");
  useEffect(() => {
    const sync = () => {
      const value = new URLSearchParams(location.search).get("lang");
      setLanguage(Object.hasOwn(copy, value) ? value : "sq");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  function changeLanguage(value) {
    const url = new URL(location.href);
    url.searchParams.set("lang", value);
    history.pushState({}, "", url);
    setLanguage(value);
  }
  const t = copy[language],
    icons = [ClipboardList, MapPin, CheckCircle2];
  return (
    <>
      <header className="bg-[#062653] text-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <a
            href={`/?lang=${language}`}
            className="text-xl font-bold tracking-tight"
          >
            kosova<span className="text-amber-300">.</span>report
          </a>
          <nav aria-label="Language" className="flex gap-1">
            {["sq", "sr", "en"].map((value) => (
              <button
                type="button"
                key={value}
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
      <div className="bg-gradient-to-b from-blue-50 via-white to-slate-50">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-blue-700">
              {t.tag}
            </p>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[#102344] sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              {t.intro}
            </p>
            <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
              {language === "sq"
                ? "Aktualisht në Prishtinë. Së bashku, hap pas hapi — së shpejti edhe në qytete të tjera."
                : language === "sr"
                  ? "Trenutno u Prištini. Zajedno, korak po korak — uskoro i u drugim gradovima."
                  : "Starting in Prishtina. Together, one neighborhood at a time — more cities will join in the future."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={`/report?lang=${language}`}
                className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-xl bg-[#0843b5] px-6 py-4 font-semibold text-white shadow-lg shadow-blue-900/10 hover:bg-blue-800"
              >
                {t.start}
                <ArrowRight size={18} />
              </a>
              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-6 py-4 text-sm font-semibold text-blue-900"
              >
                {t.how}
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-slate-600">
              {[
                [ShieldCheck, t.anonymous],
                [Globe2, t.languages],
                [ClipboardList, t.receipt],
              ].map(([Icon, label]) => (
                <span key={label} className="flex items-center gap-2">
                  <Icon size={16} className="text-blue-700" />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 shadow-xl shadow-blue-900/5 sm:p-8">
            <div
              aria-hidden="true"
              className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-50"
            />
            <div className="relative">
              <div className="mb-6 inline-flex rounded-2xl bg-blue-700 p-4 text-white">
                <MapPin size={32} />
              </div>
              <h2 className="text-lg font-bold text-[#102344]">{t.label}</h2>
              <ol className="mt-6 space-y-5">
                {t.steps.map(([title, body], index) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-800">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">
                        {body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </div>
      <section id="how" className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <h2 className="text-2xl font-bold text-[#102344]">{t.how}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {t.steps.map(([title, body], index) => {
            const Icon = icons[index];
            return (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <Icon className="mb-4 text-blue-700" size={26} />
                <h3 className="font-semibold text-[#102344]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {body}
                </p>
              </article>
            );
          })}
        </div>
        <div className="my-8 flex gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:p-7">
          <LockKeyhole size={24} className="mt-1 shrink-0 text-blue-800" />
          <div>
            <h2 className="font-semibold text-[#102344]">{t.privacyTitle}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              {t.privacy}
            </p>
          </div>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-500">
          {t.note}
        </p>
      </section>
    </>
  );
}
