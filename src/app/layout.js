import "./globals.css";

// Each section renders its own <html>: app/[locale]/layout.js for the public
// site, app/admin/layout.js for staff.
export default function RootLayout({ children }) {
  return children;
}
