// Re-encodes a photo on the device before upload. Drawing to a canvas and
// exporting a new JPEG drops all EXIF data (GPS position, camera, time) and
// shrinks phone photos to a size that uploads quickly on mobile data. The
// server still validates the result and stores it in R2 as before.
const MAX_EDGE = 2048;
const QUALITY = 0.82;
export const MAX_PHOTOS = 10;
export const MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export async function preparePhoto(file) {
  if (!ACCEPTED.includes(file.type) && !/\.(heic|heif)$/i.test(file.name))
    throw new Error("type");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const ratio = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);
  const offscreen = typeof OffscreenCanvas !== "undefined";
  const canvas = offscreen
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const encode = (quality) =>
    offscreen
      ? canvas.convertToBlob({ type: "image/jpeg", quality })
      : new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  let blob = await encode(QUALITY);
  if (blob.size > MAX_BYTES) blob = await encode(0.65);
  if (blob.size > MAX_BYTES) throw new Error("size");
  const name = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  return new File([blob], name, { type: "image/jpeg" });
}
