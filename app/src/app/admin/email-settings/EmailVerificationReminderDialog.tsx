"use client";

import { useState } from "react";

export function EmailVerificationReminderDialog({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/60 p-4"
      onClick={() => setDismissed(true)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-amber-900">
          E-Mail-Versand ist jetzt eingerichtet
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Die Pflicht-E-Mail-Verifizierung für neue Konten ist im Code aber noch
          deaktiviert (<code className="rounded bg-gray-100 px-1 py-0.5">
            requireEmailVerification: false
          </code>{" "}
          in <code className="rounded bg-gray-100 px-1 py-0.5">auth.ts</code>). Jetzt
          Claude bitten, sie zu aktivieren, damit sich neue Nutzer erst nach
          Bestätigung ihrer E-Mail-Adresse anmelden können.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            autoFocus
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            onClick={() => setDismissed(true)}
            type="button"
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}
