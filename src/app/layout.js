import "./globals.css";
import Footer from "../components/Footer";
import AppControls from "../components/AppControls";

export const metadata = {
  title: "kosova.report",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "kosova.report",
    statusBarStyle: "default",
  },
  icons: { apple: "/icons/apple-touch-icon.png" },
  referrer: "strict-origin-when-cross-origin",
  description: "Civic tech platform for institutional accountability",
};
export const viewport = {
  themeColor: "#062653",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="sq">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        <main className="flex-grow flex flex-col">{children}</main>
        <Footer />
        <AppControls />
      </body>
    </html>
  );
}
