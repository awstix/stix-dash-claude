import { ProjectAreaPage } from "../ProjectAreaPage";

export default function ProjectDocumentsPage() {
  return ProjectAreaPage({
    active: "documents",
    title: "Dokumente",
    description:
      "Dokumente projektbezogen sammeln: Aufträge, Nachträge, Pläne, Prüfzeugnisse und Schriftverkehr.",
    emptyText:
      "Hier entsteht die zentrale Dokumentenübersicht über alle sichtbaren Projekte.",
  });
}
