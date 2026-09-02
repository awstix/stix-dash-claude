import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { AI_PROVIDER_OPTIONS } from "@/lib/kalkulation-ai-provider";
import { saveAiSettings, testAiConnection } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";

export default async function KalkulationAiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; saved?: string; test?: string }>;
}) {
  const [settings, params] = await Promise.all([
    prisma.kalkulationAiSettings.findUnique({ where: { id: "default" } }),
    searchParams,
  ]);

  const currentProvider = settings?.provider ?? "anthropic";

  return (
    <AppShell
      title="KI-Einstellungen (Kalkulation)"
      description="Anbieter und API-Key für den KI-gestützten Positionsabgleich beim LV-Import."
    >
      {params.saved ? (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">
          Einstellungen gespeichert.
        </div>
      ) : null}
      {params.test === "success" ? (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">
          Verbindungstest erfolgreich.
        </div>
      ) : null}
      {params.test === "error" ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          Verbindungstest fehlgeschlagen: {params.message ?? "Unbekannter Fehler."}
        </div>
      ) : null}

      <form
        action={saveAiSettings}
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <input
            className="h-4 w-4 rounded border-gray-300"
            defaultChecked={settings?.enabled ?? false}
            name="enabled"
            type="checkbox"
          />
          KI-Abgleich aktiviert
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-gray-900">
            Anbieter
            <select className={inputClass} defaultValue={currentProvider} name="provider">
              {AI_PROVIDER_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-gray-900">
            Modell
            <input
              className={inputClass}
              defaultValue={settings?.model ?? ""}
              name="model"
              placeholder="z.B. claude-sonnet-5, gpt-4o-mini, gemini-2.5-flash"
            />
          </label>

          <label className="block text-sm font-semibold text-gray-900">
            API-Key
            <input
              className={inputClass}
              name="apiKey"
              placeholder={settings?.apiKey ? "•••••••• (unverändert lassen)" : "API-Key eingeben"}
              type="password"
            />
          </label>

          <label className="block text-sm font-semibold text-gray-900">
            Max. Kandidaten pro Position
            <input
              className={inputClass}
              defaultValue={settings?.maxCandidates ?? 5}
              max={20}
              min={1}
              name="maxCandidates"
              type="number"
            />
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Der KI-Abgleich läuft nur, wenn beim Import explizit auf
          &bdquo;KI-Abgleich starten&ldquo; geklickt wird - nie automatisch
          beim Hochladen. Jeder Anbieter berechnet pro Anfrage Kosten nach
          eigenem Preismodell.
        </p>

        <button
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          Speichern
        </button>
      </form>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Konfiguration testen</h2>
        <p className="mt-1 text-sm text-gray-600">
          Sendet eine kurze Testanfrage mit den gespeicherten Einstellungen.
        </p>
        <form action={testAiConnection} className="mt-4">
          <button
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            type="submit"
          >
            Verbindung testen
          </button>
        </form>
        {settings?.lastTestAt ? (
          <p className="mt-3 text-xs text-gray-500">
            Letzter Test:{" "}
            {new Intl.DateTimeFormat("de-DE", {
              timeZone: "Europe/Berlin",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(settings.lastTestAt)}{" "}
            –{" "}
            {settings.lastTestSuccess ? (
              <span className="font-semibold text-green-700">Erfolgreich</span>
            ) : (
              <span className="font-semibold text-red-700">
                Fehlgeschlagen{" "}
                {settings.lastTestErrorText ? `(${settings.lastTestErrorText})` : ""}
              </span>
            )}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
