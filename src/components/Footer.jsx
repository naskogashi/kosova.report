const partners = [
  { name: "CIVICUS", src: "/logos/civicus.png" },
  { name: "Metamorphosis Foundation", src: "/logos/metamorphosis.png" },
  { name: "TechSoup", src: "/logos/techsoup.png" },
  { name: "Digital Activism Program", src: "/logos/digital-activism.png" },
  {
    name: "Sbunker",
    src: "https://sbunker.org/wp-content/uploads/2023/11/sbunker22.png",
  },
];
export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-slate-200 bg-white px-4 py-8 text-slate-600">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-x-auto pb-4">
          <ul
            aria-label="Project partners"
            className="flex min-w-max items-center justify-center gap-8 sm:min-w-0"
          >
            {partners.map((partner) => (
              <li
                key={partner.name}
                className="flex h-16 w-28 shrink-0 items-center justify-center"
              >
                {partner.src ? (
                  <img
                    src={partner.src}
                    alt={partner.name}
                    className="max-h-12 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-center text-base font-bold text-[#062653]">
                    {partner.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed">
          This activity is supported by the CIVICUS Digital Democracy Initiative
          (DDI). Ky aktivitet mbështetet nga CIVICUS Digital Democracy
          Initiative (DDI).
        </p>
        <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs">
          Developed by CODON / Progon group
        </p>
      </div>
    </footer>
  );
}
