import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// An explicit locale (e.g. the staff panel's footer) wins over the [locale] segment.
export default getRequestConfig(async ({ locale: explicit, requestLocale }) => {
  const requested = explicit ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  return {
    locale,
    timeZone: "Europe/Belgrade",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
