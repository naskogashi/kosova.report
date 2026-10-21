// Re-encodes a short video on the device before upload, in the spirit of photos.js: keeps
// 5 seconds, scales to 720p, removes every audio track (voices of bystanders, background
// sounds) and every metadata tag (phones record the GPS position), using the phone's
// hardware encoder through WebCodecs. Mediabunny is loaded only when a video is chosen.
export const MAX_SECONDS = 5;
export const MAX_VIDEO_BYTES = 1_600_000;
const SHORT_EDGE = 720;
const BITRATE = 1_200_000;
const RAW_LIMIT = 300 * 1024 * 1024;

export async function videoSupported() {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return false;
  try {
    const { canEncodeVideo } = await import("mediabunny");
    return await canEncodeVideo("avc", { width: 1280, height: SHORT_EDGE, bitrate: BITRATE });
  } catch {
    return false;
  }
}

async function open(file) {
  const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

// Reads only the container header; nothing is decoded.
export async function videoDuration(file) {
  if (!file.type.startsWith("video/") || file.size > RAW_LIMIT) throw new Error("type");
  const input = await open(file);
  try {
    if (!(await input.getPrimaryVideoTrack())) throw new Error("type");
    return await input.computeDuration();
  } finally {
    input.dispose();
  }
}

// start: the second the citizen chose with the trim slider (0 for a short clip).
export async function prepareVideo(file, { start = 0, onProgress } = {}) {
  const { Output, Conversion, BufferTarget, Mp4OutputFormat, Quality } = await import("mediabunny");
  const input = await open(file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("type");
    const duration = await input.computeDuration();
    const from = Math.max(0, Math.min(start, duration - 0.5));
    const portrait = track.displayHeight > track.displayWidth;
    const edge = Math.min(SHORT_EDGE, portrait ? track.displayWidth : track.displayHeight);
    const output = new Output({
      // The index goes first, so the server can check the file from its first bytes.
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      trim: { start: from, end: Math.min(duration, from + MAX_SECONDS) },
      video: {
        ...(portrait ? { width: edge } : { height: edge }),
        frameRate: 24,
        codec: "avc",
        quality: new Quality(BITRATE),
        forceTranscode: true,
      },
      audio: { discard: true },
      tags: {},
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error("unsupported");
    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();
    const blob = new Blob([output.target.buffer], { type: "video/mp4" });
    if (blob.size > MAX_VIDEO_BYTES) throw new Error("size");
    return new File([blob], `video-${Date.now()}.mp4`, { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}
