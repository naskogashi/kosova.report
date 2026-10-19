import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8 px-4 mt-auto w-full border-t border-gray-800">
      <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-6">
        
        {/* Hanan pyytämät logot vaaditussa järjestyksessä */}
        <div className="flex flex-wrap justify-center items-center gap-6 opacity-80">
          <img src="/logos/civicus.png" alt="CIVICUS" className="h-10 object-contain" />
          <img src="/logos/metamorphosis.png" alt="Metamorphosis Foundation" className="h-10 object-contain" />
          <img src="/logos/techsoup.png" alt="TechSoup" className="h-10 object-contain" />
          <img src="/logos/digital-activism.png" alt="Digital Activism Program" className="h-10 object-contain" />
          <img src="/logos/ideongritja.png" alt="IdeoNgritja" className="h-10 object-contain" />
          <img src="/logos/sbunker.png" alt="Sbunker" className="h-10 object-contain" />
        </div>

        {/* Pakollinen donator-teksti */}
        <div className="text-sm text-gray-400 max-w-2xl leading-relaxed">
          <p>This activity is supported by the CIVICUS Digital Democracy Initiative (DDI).</p>
          <p className="mt-1">Ky aktivitet mbështetet nga CIVICUS Digital Democracy Initiative (DDI).</p>
        </div>

        {/* Kehittäjäryhmän virallinen allekirjoitus */}
        <div className="text-xs text-gray-500 border-t border-gray-800 pt-4 w-full">
          Developed by <span className="font-semibold text-gray-400">CODON / Progon group</span>
        </div>
        
      </div>
    </footer>
  );
}
