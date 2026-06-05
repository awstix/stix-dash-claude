import { ProjectAreaPage } from "../ProjectAreaPage";

export default function ProjectFormsPage() {
  return ProjectAreaPage({
    active: "forms",
    title: "Formulare",
    description:
      "Formularvorlagen projektbezogen erstellen, ausfüllen und später in der Projektakte ablegen.",
    emptyText:
      "Hier entsteht die Formularübersicht mit Vorlagen und ausgefüllten Formularen je Projekt.",
  });
}
