import { sofia } from "./fonts";

// Paths outside any locale (rare: the proxy redirects almost everything). Trilingual and plain.
export default function GlobalNotFound() {
  return (
    <html lang="sq" className={sofia.variable}>
      <body className="flex min-h-dvh items-center">
        <main className="mx-auto max-w-[34rem] px-4 py-14">
          <h1 className="text-3xl font-extrabold tracking-[-0.025em]">Faqja nuk u gjet</h1>
          <p lang="sr" className="mt-2 text-lg text-pencil">Stranica nije pronađena.</p>
          <p lang="en" className="text-lg text-pencil">Page not found.</p>
          <p className="mt-6 flex flex-wrap gap-4 font-bold text-blue">
            <a href="/sq" className="underline underline-offset-4">Shqip</a>
            <a href="/sr" lang="sr" className="underline underline-offset-4">Srpski</a>
            <a href="/en" lang="en" className="underline underline-offset-4">English</a>
          </p>
        </main>
      </body>
    </html>
  );
}
