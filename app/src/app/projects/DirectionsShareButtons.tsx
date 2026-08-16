"use client";

/** Same icon-button pattern as InitialTestShareButtons.tsx (open/download/
 * email/WhatsApp) - kept consistent across the app instead of a one-off
 * text-button + custom popover. */
type Props = {
  pdfUrl: string;
  projectLabel: string;
};

function absoluteUrl(path: string) {
  return new URL(path, window.location.origin).toString();
}

export function DirectionsShareButtons({ pdfUrl, projectLabel }: Props) {
  const title = `Wegbeschreibung zur Baustelle ${projectLabel}`;
  const iconClass = "h-5 w-5";
  const buttonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-1";

  function email() {
    window.location.href = `mailto:?subject=${encodeURIComponent(
      title,
    )}&body=${encodeURIComponent(`${title}\n${absoluteUrl(pdfUrl)}`)}`;
  }

  function whatsapp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${title}\n${absoluteUrl(pdfUrl)}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div aria-label="PDF-Aktionen" className="flex flex-wrap items-center gap-1.5">
      <a
        aria-label="PDF öffnen"
        className={`${buttonClass} border-blue-800 bg-blue-700 text-white hover:bg-blue-600`}
        href={pdfUrl}
        target="_blank"
        title="PDF öffnen"
      >
        <svg aria-hidden="true" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      </a>
      <a
        aria-label="PDF herunterladen"
        className={`${buttonClass} border-gray-800 bg-gray-950 text-white hover:bg-gray-800`}
        download
        href={pdfUrl}
        title="PDF herunterladen"
      >
        <svg aria-hidden="true" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
      <button
        aria-label="Wegbeschreibung per E-Mail versenden"
        className={`${buttonClass} border-amber-700 bg-amber-100 text-amber-950 hover:bg-amber-200`}
        onClick={email}
        title="Per E-Mail versenden"
        type="button"
      >
        <svg aria-hidden="true" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect height="14" rx="2" width="18" x="3" y="5" />
          <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        aria-label="Wegbeschreibung per WhatsApp versenden"
        className={`${buttonClass} border-green-800 bg-green-700 text-white hover:bg-green-600`}
        onClick={whatsapp}
        title="Per WhatsApp versenden"
        type="button"
      >
        <svg aria-hidden="true" className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.04 2a9.84 9.84 0 0 0-8.48 14.8L2 22l5.34-1.5A9.98 9.98 0 1 0 12.04 2Zm0 17.98a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.17.89.85-3.09-.2-.32a8.04 8.04 0 1 1 6.95 3.83Zm4.42-6.03c-.24-.12-1.44-.71-1.66-.79-.23-.08-.39-.12-.56.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2a7.28 7.28 0 0 1-1.34-1.67c-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.41.08-.16.04-.3-.02-.42-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.41-.56-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.72 2.63 4.17 3.69.58.25 1.04.4 1.39.51.59.19 1.12.16 1.54.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z" />
        </svg>
      </button>
    </div>
  );
}
