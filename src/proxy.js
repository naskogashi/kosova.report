import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { localizedPath } from "./i18n/paths";

const intl = createMiddleware(routing);
const locales = routing.locales;

// Old URLs used `?lang=` and had no locale prefix. Emails already sent link to
// /track/ID#key=… and /municipality/ID#key=…; browsers keep the #fragment
// across a redirect, so those links keep working.
function legacyRedirect(request) {
  const url = request.nextUrl;
  const lang = url.searchParams.get("lang");
  const chosen = locales.includes(lang)
    ? lang
    : locales.includes(request.cookies.get("kr-locale")?.value)
      ? request.cookies.get("kr-locale").value
      : null;
  const target = (path) => {
    const next = new URL(path, url);
    return NextResponse.redirect(next, 301);
  };
  const { pathname } = url;
  if (pathname === "/" && lang && locales.includes(lang))
    return target(localizedPath("/", lang));
  if (pathname === "/report")
    return target(localizedPath("/report", chosen || "sq"));
  let match = pathname.match(/^\/track\/([^/]+)\/?$/);
  if (match)
    return target(
      localizedPath("/track/[publicId]", chosen || "sq", {
        publicId: decodeURIComponent(match[1]),
      }),
    );
  match = pathname.match(/^\/municipality\/([^/]+)\/?$/);
  if (match)
    return target(
      localizedPath("/municipality/[publicId]", chosen || "sq", {
        publicId: decodeURIComponent(match[1]),
      }),
    );
  return null;
}

export default function proxy(request) {
  return legacyRedirect(request) || intl(request);
}

export const config = {
  // Everything except API routes, the staff panel, embeddable widgets, Next internals and static files.
  matcher: ["/((?!api|admin|embed|_next|_vercel|.*\\..*).*)"],
};
