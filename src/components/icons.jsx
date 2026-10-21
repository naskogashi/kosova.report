// One drawing system for every icon: 24px grid, 1.75 stroke, round caps and joins.
const paths = {
  infrastructure: (
    <>
      <path d="M6.5 21 9 3M17.5 21 15 3M12 4v2.2M12 9v2.2" />
      <path d="M8.6 17.2c0-1.2 1.5-2.1 3.4-2.1s3.4.9 3.4 2.1-1.5 2.1-3.4 2.1-3.4-.9-3.4-2.1Z" />
      <path d="m10.4 15.3-.7-1.2M13.8 19.2l.8 1.3" />
    </>
  ),
  environment: (
    <>
      <path d="M12 15.5c-3.6 0-6-2.3-6-5.3 0-2.2 1.3-3.6 2.7-4.1C9.3 4.1 10.6 3 12 3s2.7 1.1 3.3 3.1C16.7 6.6 18 8 18 10.2c0 3-2.4 5.3-6 5.3Z" />
      <path d="M12 21V11.5M12 15l-2.4-2M12 13.5l2-1.6M8 21h8" />
    </>
  ),
  public_services: (
    <>
      <rect x="5" y="3" width="14" height="15" rx="2.5" />
      <path d="M5 11h14M8.5 6h7M8 18v2.5M16 18v2.5" />
      <path d="M8.5 14.5h.01M15.5 14.5h.01" strokeWidth="2.4" />
    </>
  ),
  administration: (
    <>
      <path d="M14 3H6.5v18h11V6.5L14 3Z" />
      <path d="M14 3v3.5h3.5M9 10h6M9 13h3.5" />
      <circle cx="14.2" cy="17" r="2" />
    </>
  ),
  health: <path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5V4Z" />,
  education: (
    <>
      <path d="M3 10.5 12 5l9 5.5" />
      <path d="M5.5 9v11.5h13V9M10 20.5V16h4v4.5M3.5 20.5h17" />
      <circle cx="12" cy="11.2" r="1.4" />
    </>
  ),
  safety: (
    <>
      <path d="M12 3 19 5.8v5.4c0 4.4-2.9 7.9-7 9.8-4.1-1.9-7-5.4-7-9.8V5.8L12 3Z" />
      <path d="M12 6.5v11.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.6-2.5h5.4L16.3 7h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="12.8" r="3.3" />
    </>
  ),
  gallery: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="m4.5 16.5 4.2-4.2 3.3 3.3 2.2-2.2 5.3 5.1" />
      <circle cx="15.5" cy="9.5" r="1.4" />
    </>
  ),
  video: (
    <>
      <rect x="3.5" y="6.5" width="12" height="11" rx="2" />
      <path d="m15.5 10.5 5-3v9l-5-3" />
    </>
  ),
  document: (
    <>
      <path d="M7 3.5h6.5L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5Z" />
      <path d="M13.5 3.5V8H18M9 12.5h6M9 16h6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.6h.01" strokeWidth="2" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  share: (
    <>
      <path d="M12 15V4M8 7.5 12 3.8l4 3.7" />
      <path d="M8.5 10.5H7A1.5 1.5 0 0 0 5.5 12v6.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5h-1.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  menu: <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </>
  ),
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />,
  auto: (
    <>
      <path d="M12 3.5v2M4.5 12h-2M6.6 6.6 5.2 5.2" />
      <path d="M12 8a4 4 0 0 0-4 4" />
      <path d="M20.5 15A7 7 0 0 1 13 7.6 7 7 0 1 0 20.5 15Z" />
    </>
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" stroke="none" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="3.8" />
      <path d="M11.8 12H20.5M17.5 12v3M20.5 12v2.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M19 12a7 7 0 1 1-2.1-5" />
      <path d="M19 4.5v4h-4" />
    </>
  ),
  phone: (
    <>
      <path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3A2 2 0 0 1 17.5 19 14 14 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />
    </>
  ),
  home: (
    <>
      <path d="M4 11 12 4.5l8 6.5" />
      <path d="M6 9.5V19.5h12V9.5M10 19.5v-5h4v5" />
    </>
  ),
  add: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="M14 6l-6 6 6 6" />,
  chevronRight: <path d="M10 6l6 6-6 6" />,
  thumb: (
    <>
      <path d="M7.5 10.5v9h-3v-9h3Z" />
      <path d="M7.5 10.5 11 4.5a2 2 0 0 1 2.8 2.2L13 10h5.2a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17.2 20H7.5" />
    </>
  ),
  comment: <path d="M5 5.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5v-3.5H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />,
  group: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="16.5" cy="10" r="2.4" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 15.2a4.5 4.5 0 0 1 6 3.8" />
    </>
  ),
};

export function Icon({ name, className = "size-6", title, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...props}
    >
      {title && <title>{title}</title>}
      {paths[name]}
    </svg>
  );
}

// Text colour and tint for each category. Kept as literal class names so Tailwind finds them.
export const categoryStyle = {
  infrastructure: { text: "text-cat-infrastructure", tint: "tint-cat-infrastructure", border: "border-cat-infrastructure" },
  environment: { text: "text-cat-environment", tint: "tint-cat-environment", border: "border-cat-environment" },
  public_services: { text: "text-cat-public_services", tint: "tint-cat-public_services", border: "border-cat-public_services" },
  administration: { text: "text-cat-administration", tint: "tint-cat-administration", border: "border-cat-administration" },
  health: { text: "text-cat-health", tint: "tint-cat-health", border: "border-cat-health" },
  education: { text: "text-cat-education", tint: "tint-cat-education", border: "border-cat-education" },
  safety: { text: "text-cat-safety", tint: "tint-cat-safety", border: "border-cat-safety" },
};
