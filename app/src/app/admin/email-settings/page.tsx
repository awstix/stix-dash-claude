import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { saveEmailSettings, sendTestEmail } from "./actions";
import { EmailProviderPresetFields } from "./EmailProviderPresetFields";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; saved?: string; test?: string }>;
}) {
  const [settings, params] = await Promise.all([
    prisma.emailSettings.findUnique({ where: { id: "default" } }),
    searchParams,
  ]);

  return (
    <AppShell
      title="E-Mail-Versand"
      description="SMTP-Zugangsdaten für Einladungs- und Passwort-E-Mails an neue Portalnutzer."
    >
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">
          Einstellungen gespeichert.
        </div>
      ) : null}
      {params.test === "success" ? (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">
          Test-E-Mail erfolgreich gesendet.
        </div>
      ) : null}
      {params.test === "error" ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          Test-E-Mail fehlgeschlagen: {params.message ?? "Unbekannter Fehler."}
        </div>
      ) : null}

      <form
        action={saveEmailSettings}
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <input
            className="h-4 w-4 rounded border-gray-300"
            defaultChecked={settings?.enabled ?? false}
            name="enabled"
            type="checkbox"
          />
          E-Mail-Versand aktiviert
        </label>

        <EmailProviderPresetFields
          defaultFromAddress={settings?.fromAddress ?? ""}
          defaultFromName={settings?.fromName ?? ""}
          defaultProvider={settings?.provider ?? "custom"}
          defaultSmtpHost={settings?.smtpHost ?? ""}
          defaultSmtpPort={settings?.smtpPort ?? 587}
          defaultSmtpSecure={settings?.smtpSecure ?? false}
          defaultSmtpUser={settings?.smtpUser ?? ""}
          hasStoredPassword={Boolean(settings?.smtpPassword)}
          inputClass={inputClass}
        />

        <button
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          Speichern
        </button>
      </form>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Konfiguration testen
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Sendet eine Test-E-Mail mit den gespeicherten Einstellungen.
        </p>
        <form action={sendTestEmail} className="mt-4 flex flex-wrap gap-3">
          <input
            className={`${inputClass} mt-0 max-w-xs`}
            name="testRecipient"
            placeholder="empfaenger@beispiel.de"
            required
            type="email"
          />
          <button
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            type="submit"
          >
            Test-E-Mail senden
          </button>
        </form>
        {settings?.lastTestSentAt ? (
          <p className="mt-3 text-xs text-gray-500">
            Letzter Test:{" "}
            {new Intl.DateTimeFormat("de-DE", {
              timeZone: "Europe/Berlin",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(settings.lastTestSentAt)}{" "}
            –{" "}
            {settings.lastTestSuccess ? (
              <span className="font-semibold text-green-700">
                Erfolgreich
              </span>
            ) : (
              <span className="font-semibold text-red-700">
                Fehlgeschlagen{" "}
                {settings.lastTestErrorText
                  ? `(${settings.lastTestErrorText})`
                  : ""}
              </span>
            )}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
