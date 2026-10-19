import { readFile } from "node:fs/promises";
import path from "node:path";
import { insideBoundary } from "./boundary-geometry";

// Server-side check that a pin lies inside the chosen municipality's official
// boundary (public/boundaries/<CODE>.json, made with `npm run boundary`).
// A city without a boundary file yet is not blocked, so new cities still work.
const cache = new Map();
async function boundary(code) {
  if (!/^[A-Z0-9]{2,10}$/.test(code)) return null;
  if (!cache.has(code))
    cache.set(
      code,
      readFile(path.join(process.cwd(), "public", "boundaries", `${code}.json`), "utf8")
        .then(JSON.parse)
        .catch(() => null),
    );
  return cache.get(code);
}

export async function pinInsideCity(code, point) {
  const feature = await boundary(code);
  return feature ? insideBoundary(feature, point) : true;
}
