import { routing } from "./routing";

// Builds the localized public path for an internal pathname, e.g. "/track/[publicId]".
export function localizedPath(internal, requested, params = {}) {
  // Unknown segments (e.g. "/favicon.ico" reaching [locale]) fall back to Albanian instead of crashing.
  const locale = routing.locales.includes(requested) ? requested : routing.defaultLocale;
  const entry = routing.pathnames[internal];
  const template = typeof entry === "string" ? entry : entry[locale];
  const path = template.replace(/\[(\w+)\]/g, (_, key) =>
    encodeURIComponent(params[key]),
  );
  return `/${locale}${path === "/" ? "" : path}`;
}
