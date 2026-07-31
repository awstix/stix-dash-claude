"use client";

import { useState, useTransition } from "react";
import { previewTimeApprovalReminders, type ReminderPreviewResult } from "./actions";

export function ReminderCheckButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReminderPreviewResult | null>(null);
  const [error, setError] = useState("");

  function check() {
    setError("");
    startTransition(async () => {
      try {
        setResult(await previewTimeApprovalReminders());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Prüfung fehlgeschlagen.");
      }
    });
  }

  return (
    <div>
      <button
        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
        disabled={pending}
        onClick={check}
        type="button"
      >
        {pending ? "Prüfe …" : "Jetzt prüfen (ohne zu senden)"}
      </button>
      <p className="mt-2 text-xs text-gray-500">
        Zeigt, für welche Baustellen heute laut Zeitplan eine Erinnerung fällig wäre und wer sie
        bekäme. Solange SMTP nicht konfiguriert ist, wird noch keine E-Mail tatsächlich verschickt.
      </p>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-2">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              result.smtpConfigured
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {result.smtpConfigured
              ? "SMTP ist konfiguriert."
              : "SMTP ist noch nicht konfiguriert (SMTP_HOST/SMTP_FROM) – Versand ist vorbereitet, aber inaktiv."}
          </div>

          {result.reminders.length ? (
            <ul className="space-y-2">
              {result.reminders.map((reminder) => (
                <li
                  key={reminder.projectLabel}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800"
                >
                  <div className="font-semibold text-gray-900">{reminder.projectLabel}</div>
                  <div className="mt-1">{reminder.pendingEntryCount} offene Freigabe(n)</div>
                  {reminder.constructionManagers.length ? (
                    <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                      {reminder.constructionManagers.map((manager) => (
                        <div key={manager.name}>
                          Bauleiter {manager.name}: {manager.email ?? "keine E-Mail in der Personalakte gefunden"}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-600">Kein Bauleiter hinterlegt.</div>
                  )}
                  {reminder.extraRecipients.length ? (
                    <div className="mt-1 text-xs text-gray-600">
                      Zusätzlich: {reminder.extraRecipients.join(", ")}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Heute ist laut Zeitplan keine Erinnerung mit offenen Freigaben fällig.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
