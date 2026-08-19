import { AppShell } from "@/components/AppShell";
import { getInventoryBookingSettings, updateInventoryBookingSettings } from "./actions";

export default async function InventoryBookingOptionsPage() {
  const settings = await getInventoryBookingSettings();

  return (
    <AppShell
      description="Steuert, wie manuelle Baustellen-/Personen-Zuordnungen über das Inventar für Dispo und Leistungsmeldung wirken."
      title="Inventar · Buchungsoptionen"
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Sondergerätedisposition</h2>
          <p className="mt-1 text-sm text-gray-600">
            Wird ein Sondergerät (Inventarobjekt) manuell einer Baustelle oder Person zugeordnet
            (Objektseite → Zuweisung), legt das immer einen Sondergeräte-Dispo-Eintrag für den
            heutigen Tag an. Diese Einstellung steuert, ob dieser Eintrag danach automatisch Tag
            für Tag verlängert wird.
          </p>

          <form action={updateInventoryBookingSettings} className="mt-5 space-y-3">
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <input
                className="mt-1 h-4 w-4"
                defaultChecked={settings.specialVehicleAutoExtend}
                name="specialVehicleAutoExtend"
                type="radio"
                value="on"
              />
              <span className="text-sm">
                <span className="font-semibold text-gray-900">
                  An - Buchungen bleiben bis zur Umbuchung gültig
                </span>
                <span className="mt-1 block text-gray-600">
                  Buchungen über das Inventar bleiben so lange auf der Baustelle/Person gebucht,
                  bis eine Umbuchung stattfindet - werden täglich automatisch verlängert (nächtlicher
                  Hintergrund-Job).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <input
                className="mt-1 h-4 w-4"
                defaultChecked={!settings.specialVehicleAutoExtend}
                name="specialVehicleAutoExtend"
                type="radio"
                value="off"
              />
              <span className="text-sm">
                <span className="font-semibold text-gray-900">
                  Aus - Buchungen müssen täglich stattfinden
                </span>
                <span className="mt-1 block text-gray-600">
                  Die Zuordnung gilt nur für den Tag, an dem sie eingetragen wurde. Für Folgetage
                  muss die Zuordnung erneut gespeichert oder der Eintrag über die
                  Sondergeräte-Dispo-Kalenderansicht selbst verlängert werden.
                </span>
              </span>
            </label>

            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Speichern
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-bold text-blue-950">
            Zum Vergleich: normale Inventarobjekte (Gerätedispo)
          </h2>
          <p className="mt-1 text-sm leading-6 text-blue-900">
            Bei normalen Inventarobjekten (Bagger, Walzen usw.) läuft die manuelle Zuordnung anders
            ab und braucht keinen Schalter: die Gerätedisposition arbeitet mit einem Zeitraum
            (Start-/Enddatum) statt einzelnen Tageseinträgen. Eine manuelle Zuordnung legt dort
            direkt einen Eintrag mit offenem Enddatum an - er bleibt also immer automatisch gültig,
            bis er hier auf eine andere Baustelle umgezogen oder entfernt wird, ganz ohne
            täglichen Hintergrund-Job.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
