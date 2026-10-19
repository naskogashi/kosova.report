"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "../i18n/navigation";
import { Icon } from "./icons";
import { btn, field } from "./ui";

const numberPattern = /^[A-Z0-9]{2,10}-\d{4}-\d{6,12}$/;
const keyPattern = /^[A-Za-z0-9_-]{32,64}$/;

// Report number + private key. Paste-friendly: spaces and stray characters are cleaned up.
export default function TrackForm({ initialNumber = "", notice }) {
  const t = useTranslations("track");
  const router = useRouter();
  const [number, setNumber] = useState(initialNumber);
  const [key, setKey] = useState("");
  const [errors, setErrors] = useState({});
  function submit(event) {
    event.preventDefault();
    const cleanNumber = number.trim().toUpperCase().replace(/\s+/g, "");
    const cleanKey = key.trim().replace(/\s+/g, "");
    const found = {};
    if (!numberPattern.test(cleanNumber)) found.number = t("invalidNumber");
    if (!keyPattern.test(cleanKey)) found.key = t("invalidKey");
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(found.number ? "track-number" : "track-key")?.focus();
      return;
    }
    try {
      sessionStorage.setItem(`kr-key:${cleanNumber}`, cleanKey);
    } catch {}
    router.push({ pathname: "/track/[publicId]", params: { publicId: cleanNumber } });
  }
  const error = (name) =>
    errors[name] && (
      <p id={`${name}-error`} className={field.error}>
        <Icon name="info" className="mt-0.5 size-4 shrink-0" />
        {errors[name]}
      </p>
    );
  return (
    <form onSubmit={submit} noValidate className="mt-8 grid max-w-[34rem] gap-6">
      {notice && (
        <p role="status" className="rounded-md bg-wash p-3 text-sm font-semibold">
          {notice}
        </p>
      )}
      <div>
        <label htmlFor="track-number" className={field.label}>
          {t("number")}
        </label>
        <span id="number-hint" className={field.hint}>
          {t("numberHint")}
        </span>
        <input
          id="track-number"
          className={`${field.input} tabular uppercase`}
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="next"
          aria-invalid={Boolean(errors.number)}
          aria-describedby={["number-hint", errors.number && "number-error"].filter(Boolean).join(" ")}
        />
        {error("number")}
      </div>
      <div>
        <label htmlFor="track-key" className={field.label}>
          {t("key")}
        </label>
        <span id="key-hint" className={field.hint}>
          {t("keyHint")}
        </span>
        <input
          id="track-key"
          className={`${field.input} tabular`}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
          translate="no"
          aria-invalid={Boolean(errors.key)}
          aria-describedby={["key-hint", errors.key && "key-error"].filter(Boolean).join(" ")}
        />
        {error("key")}
      </div>
      <button type="submit" className={`${btn.primary} sm:justify-self-start`}>
        {t("submit")}
      </button>
    </form>
  );
}
