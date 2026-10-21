// Re-encodes a short video on the device before upload, in the spirit of photos.js: keeps
// 5 seconds, scales to 720p, removes every audio track (voices of bystanders, background
// sounds) and every metadata tag (phones record the GPS position), using the phone's
// hardware encoder through WebCodecs. Mediabunny is loaded only when a video is chosen.
export const MAX_SECONDS = 5;
export const MAX_VIDEO_BYTES = 1_600_000;
// Tried in order: some phone encoders refuse 720p in the browser but take 480p.
const SHORT_EDGES = [720, 480];
const BITRATE = 1_200_000;
const RAW_LIMIT = 300 * 1024 * 1024;

// Whether this browser can encode H.264 at all. Sizes are tried per video in prepareVideo.
export async function videoSupported() {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return false;
  try {
    const { canEncodeVideo } = await import("mediabunny");
    return await canEncodeVideo("avc");
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
// Errors: "format" when the browser can't open this recording (often HDR or HEVC from newer
// phones), "unsupported" when it can't encode H.264, "size" when the result is still too big.
export async function prepareVideo(file, { start = 0, onProgress } = {}) {
  for (const [index, shortEdge] of SHORT_EDGES.entries()) {
    try {
      return await convert(file, { start, onProgress, shortEdge });
    } catch (error) {
      if (error.message !== "unsupported" || index === SHORT_EDGES.length - 1) throw error;
    }
  }
}

async function convert(file, { start, onProgress, shortEdge }) {
  const { Output, Conversion, BufferTarget, Mp4OutputFormat, Quality } = await import("mediabunny");
  const input = await open(file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("type");
    const duration = await input.computeDuration();
    const from = Math.max(0, Math.min(start, duration - 0.5));
    const portrait = track.displayHeight > track.displayWidth;
    const edge = Math.min(shortEdge, portrait ? track.displayWidth : track.displayHeight);
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
        quality: new Quality({ bitrate: BITRATE }),
        forceTranscode: true,
      },
      audio: { discard: true },
      tags: {},
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const reason = conversion.discardedTracks.find((item) => item.track.type === "video")?.reason;
      throw new Error(reason === "undecodable_source_codec" || reason === "unknown_source_codec" ? "format" : "unsupported");
    }
    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();
    const blob = new Blob([output.target.buffer], { type: "video/mp4" });
    if (blob.size > MAX_VIDEO_BYTES) throw new Error("size");
    return new File([blob], `video-${Date.now()}.mp4`, { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}
