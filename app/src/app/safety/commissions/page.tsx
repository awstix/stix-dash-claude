import { SafetyInstructionManagementPage } from "../_components/SafetyInstructionManagementPage";

export default function SafetyCommissionsPage() {
  return (
    <SafetyInstructionManagementPage
      kind={{
        createDescription:
          "Beauftragung als Vorlage anlegen. Typische Punkte sind Tätigkeit, Gerät, Verantwortungsbereich, Voraussetzungen und Bestätigung durch Unterschrift.",
        description:
          "Beauftragungen projekt- oder mitarbeiterbezogen öffnen, Inhalte abhaken und Mitarbeiter digital bestätigen lassen.",
        emptyText:
          "Noch keine Beauftragungen angelegt. Lege oben die erste Vorlage an.",
        title: "Beauftragungen",
        type: "COMMISSION",
      }}
    />
  );
}
