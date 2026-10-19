import "./globals.css";
import Footer from "../components/Footer";

export const metadata = {
  title: "kosova.report",
  referrer: "strict-origin-when-cross-origin",
  description: "Civic tech platform for institutional accountability",
};

export default function RootLayout({ children }) {
  return (
    <html lang="sq">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        <main className="flex-grow flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
