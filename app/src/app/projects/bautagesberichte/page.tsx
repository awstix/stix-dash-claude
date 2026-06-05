import { ProjectAreaPage } from "../ProjectAreaPage";

export default function ProjectDailyReportsPage() {
  return ProjectAreaPage({
    active: "daily-reports",
    title: "Bautagesberichte",
    description:
      "Bautagesberichte projektbezogen erstellen und später mit Personal, Geräten, Wetter und Tagesnotizen verbinden.",
    emptyText:
      "Hier entsteht die Bautagesberichte-Übersicht über alle sichtbaren Projekte.",
  });
}
