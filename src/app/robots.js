import { siteOrigin } from "../lib/seo";

// Private pages (success, tracking, department links, staff panel) are also noindex in their metadata.
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/*/municipality/", "/*/raporto/u-dergua", "/*/prijavi/poslato", "/*/report/sent"],
      },
    ],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
