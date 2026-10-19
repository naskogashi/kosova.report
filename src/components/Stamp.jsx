// Round office stamp. Text runs over the top and under the bottom, like a rubber stamp.
const star = (cx, cy) =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 1.7 : 4.2;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");

export default function Stamp({ word, city, publicId, date, className = "", ...props }) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true" {...props}>
      <defs>
        <path id="stamp-top" d="M22 80a58 58 0 0 1 116 0" />
        <path id="stamp-bottom" d="M14 80a66 66 0 0 0 132 0" />
        <filter id="stamp-ink" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.2" />
        </filter>
      </defs>
      <g filter="url(#stamp-ink)" fill="currentColor" className="font-stamp">
        <circle cx="80" cy="80" r="75" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <circle cx="80" cy="80" r="47" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <text fontSize="15" fontWeight="800" letterSpacing="2">
          <textPath href="#stamp-top" startOffset="50%" textAnchor="middle">
            KOSOVA.REPORT
          </textPath>
        </text>
        <text fontSize="13" fontWeight="800" letterSpacing="2">
          <textPath href="#stamp-bottom" startOffset="50%" textAnchor="middle">
            {city.toUpperCase()}
          </textPath>
        </text>
        <polygon points={star(13, 80)} />
        <polygon points={star(147, 80)} />
        <text x="80" y="76" textAnchor="middle" fontSize="25" fontWeight="900">
          {word.toUpperCase()}
        </text>
        {publicId && (
          <text
            x="80"
            y="93"
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="800"
            letterSpacing="0.5"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {publicId}
          </text>
        )}
        {date && (
          <text
            x="80"
            y="108"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {date}
          </text>
        )}
      </g>
    </svg>
  );
}
