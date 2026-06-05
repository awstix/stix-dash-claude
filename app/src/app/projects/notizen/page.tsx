import { ProjectAreaPage } from "../ProjectAreaPage";

export default function ProjectNotesPage() {
  return ProjectAreaPage({
    active: "notes",
    title: "Notizen",
    description:
      "Notizen projektbezogen erfassen und später nach Datum, Nutzer und Sichtbarkeit führen.",
    emptyText:
      "Hier entsteht die Notizenübersicht über alle sichtbaren Projekte.",
  });
}
