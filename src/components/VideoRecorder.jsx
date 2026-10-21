"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Sheet from "./Sheet";
import { Icon } from "./icons";
import { btn } from "./ui";
import { MAX_SECONDS } from "../lib/video";

// Records up to 5 seconds with the back camera inside the page. The microphone is never asked
// for. Recording here instead of in the phone's camera app also avoids camera formats the
// browser can't open (HEVC, Dolby Vision); the clip then goes through prepareVideo like any other.
const TYPES = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
export const canRecord = () =>
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

export default function VideoRecorder({ open, onClose, onRecorded }) {
  const t = useTranslations("report");
  const preview = useRef(null);
  const stream = useRef(null);
  const recorder = useRef(null);
  const timers = useRef([]);
  const cancelled = useRef(false);
  // starting | ready | recording | denied | failed
  const [state, setState] = useState("starting");
  const [left, setLeft] = useState(MAX_SECONDS);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    cancelled.current = false;
    setState("starting");
    setLeft(MAX_SECONDS);
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((media) => {
        if (!alive) return media.getTracks().forEach((track) => track.stop());
        stream.current = media;
        if (preview.current) preview.current.srcObject = media;
        setState("ready");
      })
      .catch((error) => alive && setState(error?.name === "NotAllowedError" ? "denied" : "failed"));
    return () => {
      alive = false;
      cancelled.current = true;
      timers.current.forEach(clearTimeout);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [open]);

  function record() {
    const type = TYPES.find((value) => MediaRecorder.isTypeSupported(value)) || "";
    const chunks = [];
    const media = new MediaRecorder(stream.current, type ? { mimeType: type, videoBitsPerSecond: 4_000_000 } : undefined);
    recorder.current = media;
    media.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    media.onstop = () => {
      if (cancelled.current || !chunks.length) return;
      const mime = (media.mimeType || type || "video/webm").split(";")[0];
      onRecorded(new File(chunks, `recording-${Date.now()}.${mime === "video/mp4" ? "mp4" : "webm"}`, { type: mime }));
    };
    media.start(250);
    setState("recording");
    const started = Date.now();
    const tick = () => {
      const remaining = MAX_SECONDS - (Date.now() - started) / 1000;
      setLeft(Math.max(0, Math.ceil(remaining)));
      if (remaining > 0) timers.current.push(setTimeout(tick, 200));
    };
    tick();
    // Stops on its own; the conversion keeps exactly 5 seconds.
    timers.current.push(setTimeout(stop, MAX_SECONDS * 1000));
  }
  function stop() {
    timers.current.forEach(clearTimeout);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("details.recorderTitle")} titleId="recorder-title" closeLabel={t("details.closeRecorder")}>
      <p className="text-sm text-pencil">{t("details.recorderHint")}</p>
      <div className="relative mt-3 overflow-hidden rounded-md bg-ink">
        <video ref={preview} autoPlay muted playsInline className="aspect-[3/4] max-h-[55svh] w-full object-cover" />
        {state === "recording" && (
          <p role="status" className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-ink/80 px-3 py-1.5 text-sm font-bold text-paper">
            <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-error" />
            {t("details.recordingLeft", { seconds: left })}
          </p>
        )}
      </div>
      {state === "starting" && (
        <p role="status" className="mt-3 text-sm font-semibold text-pencil">
          {t("details.cameraStarting")}
        </p>
      )}
      {(state === "denied" || state === "failed") && (
        <p role="alert" className="mt-3 text-sm font-semibold text-error">
          {t(state === "denied" ? "details.cameraDenied" : "details.cameraFailed")}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {state === "ready" && (
          <button type="button" onClick={record} className={btn.primary}>
            <Icon name="video" className="size-5" />
            {t("details.startRecording")}
          </button>
        )}
        {state === "recording" && (
          <button type="button" onClick={stop} className={btn.primary}>
            {t("details.stopRecording")}
          </button>
        )}
        <button type="button" onClick={onClose} className={btn.link}>
          {t("details.closeRecorder")}
        </button>
      </div>
    </Sheet>
  );
}
