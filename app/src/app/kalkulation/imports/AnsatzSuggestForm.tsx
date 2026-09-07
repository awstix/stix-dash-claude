"use client";

import { useState } from "react";
import { suggestAnsaetzeFromHistory } from "./actions";

/** Button-Text ändert sich mit der Projekt-Auswahl ("Kalkulationsansätze
 * aus Projekt X verwenden" statt einer immer gleichen Beschriftung), damit
 * sichtbar ist, dass Dropdown und Button zusammengehören - dafür Client-
 * Komponente, eine Server-Aktion kann als Formular-Aktion aber unverändert
 * direkt übergeben werden. */
export function AnsatzSuggestForm({
  eligibleTargetProjectNumbers,
  projectNumber,
  returnTo,
}: {
  eligibleTargetProjectNumbers: string[];
  projectNumber: string;
  returnTo: string;
}) {
  const [target, setTarget] = useState("");

  return (
    <form action={suggestAnsaetzeFromHistory} className="flex flex-wrap items-center gap-2">
      <input name="projectNumber" type="hidden" value={projectNumber} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <select
        className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
        name="targetProjectNumber"
        onChange={(event) => setTarget(event.target.value)}
        title="Gegen alle Projekte oder gezielt gegen ein bestimmtes Projekt abgleichen"
        value={target}
      >
        <option value="">Alle Projekte</option>
        {eligibleTargetProjectNumbers.map((number) => (
          <option key={number} value={number}>
            Nur Projekt {number}
          </option>
        ))}
      </select>
      <button
        className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        title="Befüllt noch leere Positionen der Kalkulation dieses Projekts mit den ähnlichsten Ansätzen aus anderen Projekten - vorhandene Ansätze bleiben unangetastet"
        type="submit"
      >
        {target ? `Kalkulationsansätze aus Projekt ${target} verwenden` : "Ansätze aus anderen Projekten vorschlagen"}
      </button>
    </form>
  );
}
