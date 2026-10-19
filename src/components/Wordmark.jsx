// kosova.report with the full stop drawn as a gold map pin.
export default function Wordmark({ className = "text-2xl" }) {
  return (
    <span
      className={`inline-flex items-baseline font-extrabold tracking-[-0.02em] leading-none ${className}`}
    >
      kosova
      <svg
        viewBox="0 0 10 14"
        aria-hidden="true"
        className="mx-[0.05em] h-[0.5em] w-[0.36em] fill-gold"
      >
        <path d="M5 14C5 14 0 8 0 5a5 5 0 0 1 10 0c0 3-5 9-5 9Z" />
      </svg>
      report
    </span>
  );
}
