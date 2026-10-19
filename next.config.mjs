import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.js");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets local browser tests on 127.0.0.1 use hot reload in `next dev`. No effect in production.
  allowedDevOrigins: ["127.0.0.1"],
};

export default withNextIntl(nextConfig);
