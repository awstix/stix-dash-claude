import { SafetyInstructionManagementPage } from "../_components/SafetyInstructionManagementPage";

export default function OperatingInstructionsPage() {
  return (
    <SafetyInstructionManagementPage
      kind={{
        createDescription:
          "Betriebsunterweisung als Vorlage anlegen. Typische Punkte sind Gefahren, Schutzmaßnahmen, Verhalten im Störfall und Unterschriftennachweis.",
        description:
          "Betriebsunterweisungen öffnen, Bereiche abhaken und Mitarbeiter digital unterschreiben lassen.",
        emptyText:
          "Noch keine Betriebsunterweisungen angelegt. Lege oben die erste Vorlage an.",
        title: "Betriebsunterweisungen",
        type: "OPERATING_INSTRUCTION",
      }}
    />
  );
}
