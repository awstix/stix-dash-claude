import { SafetyInstructionManagementPage } from "../../_components/SafetyInstructionManagementPage";

export default function RiskAssessmentTemplatesPage() {
  return (
    <SafetyInstructionManagementPage
      kind={{
        createDescription: "Gefährdungsbeurteilung als Unterweisungsvorlage anlegen.",
        description: "Allgemeine Gefährdungsbeurteilungen und Unterweisungsvorlagen verwalten.",
        emptyText: "Noch keine weitere Gefährdungsbeurteilung angelegt.",
        title: "Weitere Gefährdungsbeurteilungen",
        type: "RISK_ASSESSMENT",
      }}
    />
  );
}
