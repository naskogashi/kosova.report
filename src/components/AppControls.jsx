"use client";
import { useEffect, useRef, useState } from "react";
import { Cookie, ChevronDown, ShieldCheck, X } from "lucide-react";
import useLanguage from "./useLanguage";
const words = {
  sq: {
    cookies: "Privatësia dhe cookies",
    title: "Vetëm cookies të domosdoshme",
    body: "Nuk përdorim cookies reklamimi ose analitike. Hyrja administrative përdor një cookie sigurie. Ruajmë zgjedhjen tuaj për këtë njoftim në pajisje. Harta ngarkon imazhe nga ofruesi i hartës, i cili merr adresën tuaj IP. Instalimi ruan vetëm faqen jashtë linje dhe ikonat; raportet private nuk ruhen në cache.",
    ok: "E kuptova",
    install: "Instalo aplikacionin",
    help: "Në iPhone/iPad: hapeni në Safari, zgjidhni Ndaj dhe Shto në ekranin kryesor. Në shfletues të tjerë, kërkoni Instalo aplikacionin në meny.",
    close: "Mbyll",
    intro:
      "Privatësia juaj ka rëndësi. Përdorim vetëm cookies të domosdoshme për sigurinë, pa gjurmim reklamash ose analitikë.",
    necessary: "Vetëm të domosdoshmet",
    customise: "Personalizo",
    essential: "Siguria dhe preferencat",
    always: "Gjithmonë aktive",
    save: "Ruaj preferencat",
  },
  sr: {
    cookies: "Privatnost i kolačići",
    title: "Samo neophodni kolačići",
    body: "Ne koristimo reklamne ili analitičke kolačiće. Administratorska prijava koristi bezbednosni kolačić. Izbor za ovo obaveštenje čuvamo na uređaju. Mapa učitava slike od pružaoca mape koji prima vašu IP adresu. Instalacija čuva samo stranicu van mreže i ikone; privatne prijave se ne keširaju.",
    ok: "Razumem",
    install: "Instaliraj aplikaciju",
    help: "Na iPhone/iPad uređaju: otvorite Safari, izaberite Deli, zatim Dodaj na početni ekran. U drugim pregledačima potražite Instaliraj aplikaciju u meniju.",
    close: "Zatvori",
    intro:
      "Vaša privatnost je važna. Koristimo samo neophodne kolačiće za bezbednost, bez reklamnog praćenja ili analitike.",
    necessary: "Samo neophodni",
    customise: "Prilagodi",
    essential: "Bezbednost i postavke",
    always: "Uvek aktivno",
    save: "Sačuvaj postavke",
  },
  en: {
    cookies: "Privacy & cookies",
    title: "Essential cookies only",
    body: "We use no advertising or analytics cookies. Admin sign-in uses a security cookie. Your acknowledgement of this notice is stored on your device. The map loads images from a map provider, which receives your IP address. Installation stores only the offline page and icons; private reports are never cached.",
    ok: "Understood",
    install: "Install app",
    help: "On iPhone/iPad: open in Safari, choose Share, then Add to Home Screen. In other browsers, look for Install app in the browser menu.",
    close: "Close",
    intro:
      "Your privacy matters. We use only essential cookies for security, with no advertising tracking or analytics.",
    necessary: "Necessary only",
    customise: "Customise",
    essential: "Security and preferences",
    always: "Always active",
    save: "Save preferences",
  },
};
export default function AppControls() {
  const language = useLanguage(),
    t = words[language];
  const [notice, setNotice] = useState(false),
    [prompt, setPrompt] = useState(null),
    [installed, setInstalled] = useState(false),
    [help, setHelp] = useState(false),
    [details, setDetails] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    if (notice && !dialog.current.open) dialog.current.showModal();
    else if (!notice && dialog.current.open) dialog.current.close();
  }, [notice]);
  function acknowledge() {
    try {
      localStorage.setItem("kr-privacy-notice-v2", "necessary-only");
    } catch {}
    setNotice(false);
    setDetails(false);
  }
  useEffect(() => {
    try {
      setNotice(
        localStorage.getItem("kr-privacy-notice-v2") !== "necessary-only",
      );
    } catch {
      setNotice(true);
    }
    const standalone = window.matchMedia("(display-mode: standalone)");
    const sync = () =>
      setInstalled(standalone.matches || Boolean(navigator.standalone));
    sync();
    const capture = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
      setHelp(false);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    standalone.addEventListener("change", sync);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
      standalone.removeEventListener("change", sync);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setHelp(!help);
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } finally {
      setPrompt(null);
    }
  }
  return (
    <section
      className="border-t border-slate-200 bg-white px-4 py-4 text-sm text-slate-600"
      aria-label={t.cookies}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          className="rounded-lg px-3 py-2 underline underline-offset-4"
          onClick={() => {
            setDetails(false);
            setNotice(true);
          }}
          aria-expanded={notice}
        >
          {t.cookies}
        </button>
        {!installed && (
          <button
            type="button"
            onClick={install}
            className="rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white"
          >
            {t.install}
          </button>
        )}
      </div>
      {help && (
        <p
          role="status"
          className="mx-auto mt-3 max-w-2xl rounded-xl bg-blue-50 p-4 text-blue-900"
        >
          {t.help}
        </p>
      )}
      <dialog
        ref={dialog}
        className="cookie-sheet"
        aria-labelledby="cookie-title"
        aria-describedby="cookie-description"
        onCancel={() => setNotice(false)}
        onClose={() => setNotice(false)}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-900">
            <Cookie size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="cookie-title"
              className="text-base font-semibold text-slate-950"
            >
              {t.title}
            </h2>
            <p
              id="cookie-description"
              className="mt-1 text-sm leading-relaxed text-slate-600"
            >
              {t.intro}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            onClick={() => setNotice(false)}
            aria-label={t.close}
          >
            <X size={18} />
          </button>
        </div>
        {details && (
          <div
            id="cookie-details"
            className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                <ShieldCheck size={18} aria-hidden="true" />
                {t.essential}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
                {t.always}
              </span>
            </div>
            <p className="leading-relaxed text-slate-600">{t.body}</p>
          </div>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={acknowledge}
            className="min-h-11 w-full rounded-full bg-[#062653] px-5 py-3 text-sm font-semibold text-white hover:bg-blue-900"
          >
            {details ? t.save : t.necessary}
          </button>
          <button
            type="button"
            aria-expanded={details}
            aria-controls="cookie-details"
            onClick={() => setDetails(!details)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t.customise}
            <ChevronDown
              size={16}
              className={details ? "rotate-180" : ""}
              aria-hidden="true"
            />
          </button>
        </div>
      </dialog>
    </section>
  );
}
