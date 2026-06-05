import { ProjectAreaPage } from "../ProjectAreaPage";

export default function ProjectPhotosPage() {
  return ProjectAreaPage({
    active: "photos",
    title: "Fotos",
    description:
      "Fotos projektbezogen sammeln, später mit Upload, Vorschau und Datum je Baustelle.",
    emptyText:
      "Hier entsteht die zentrale Fotoübersicht über alle sichtbaren Projekte.",
  });
}
