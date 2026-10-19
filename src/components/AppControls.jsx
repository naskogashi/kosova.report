"use client";
import { useEffect, useState } from "react";
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
  },
  sr: {
    cookies: "Privatnost i kolačići",
    title: "Samo neophodni kolačići",
    body: "Ne koristimo reklamne ili analitičke kolačiće. Administratorska prijava koristi bezbednosni kolačić. Izbor za ovo obaveštenje čuvamo na uređaju. Mapa učitava slike od pružaoca mape koji prima vašu IP adresu. Instalacija čuva samo stranicu van mreže i ikone; privatne prijave se ne keširaju.",
    ok: "Razumem",
    install: "Instaliraj aplikaciju",
    help: "Na iPhone/iPad uređaju: otvorite Safari, izaberite Deli, zatim Dodaj na početni ekran. U drugim pregledačima potražite Instaliraj aplikaciju u meniju.",
    close: "Zatvori",
  },
  en: {
    cookies: "Privacy & cookies",
    title: "Essential cookies only",
    body: "We use no advertising or analytics cookies. Admin sign-in uses a security cookie. Your acknowledgement of this notice is stored on your device. The map loads images from a map provider, which receives your IP address. Installation stores only the offline page and icons; private reports are never cached.",
    ok: "Understood",
    install: "Install app",
    help: "On iPhone/iPad: open in Safari, choose Share, then Add to Home Screen. In other browsers, look for Install app in the browser menu.",
    close: "Close",
  },
};
export default function AppControls() {
  const language = useLanguage(),
    t = words[language];
  const [notice, setNotice] = useState(false),
    [prompt, setPrompt] = useState(null),
    [installed, setInstalled] = useState(false),
    [help, setHelp] = useState(false);
  useEffect(() => {
    try {
      setNotice(
        localStorage.getItem("kr-privacy-notice-v1") !== "acknowledged",
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
          onClick={() => setNotice(!notice)}
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
      {notice && (
        <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900">{t.title}</h2>
          <p className="mt-2 leading-relaxed">{t.body}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white"
            onClick={() => {
              try {
                localStorage.setItem("kr-privacy-notice-v1", "acknowledged");
              } catch {}
              setNotice(false);
            }}
          >
            {t.ok}
          </button>
        </div>
      )}
    </section>
  );
}
