import { suggestAnsaetzeFromHistory } from "./actions";

/** Der Projekt-Filter ("alle Projekte" vs. gezielt eins) lebt jetzt direkt
 * in der Abgleich-Kachel (crossLvTargetProjectNumber, siehe
 * updateCrossLvSettings) - diese Aktion liest ihn von dort, statt ein
 * eigenes Dropdown mitzubringen, damit "Abgleich starten" und "Ansätze
 * vorschlagen" immer denselben Projekt-Filter verwenden. */
export function AnsatzSuggestForm({
  projectNumber,
  returnTo,
}: {
  projectNumber: string;
  returnTo: string;
}) {
  return (
    <form action={suggestAnsaetzeFromHistory}>
      <input name="projectNumber" type="hidden" value={projectNumber} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <button
        className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        title="Übernimmt für jede noch offene Position sofort den besten Ansatz aus anderen Projekten - bereits entschiedene Positionen (bestätigt oder verworfen) bleiben unangetastet. Nutzt den in der Abgleich-Kachel eingestellten Projekt-Filter. Bis zu 2 weitere Kandidaten stehen danach je Position unter 'Andere Vorschläge' zur Auswahl."
        type="submit"
      >
        Alle besten Vorschläge übernehmen
      </button>
    </form>
  );
}
