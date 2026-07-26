import { SafetyInstructionManagementPage } from "../_components/SafetyInstructionManagementPage";

export default function RiskAssessmentsPage() {
  return (
    <SafetyInstructionManagementPage
      kind={{
        createDescription:
          "Gefährdungsbeurteilung als Unterweisungsvorlage anlegen. Die einzelnen Zeilen werden später als Haken im Unterweisungsformular angezeigt.",
        description:
          "Gefährdungsbeurteilungen projektbezogen öffnen, Unterweisungsbereiche abhaken und Mitarbeiter unterschreiben lassen.",
        emptyText:
          "Noch keine Gefährdungsbeurteilungen angelegt. Lege oben die erste Vorlage an.",
        title: "Gefährdungsbeurteilungen",
        type: "RISK_ASSESSMENT",
      }}
    />
  );
}
