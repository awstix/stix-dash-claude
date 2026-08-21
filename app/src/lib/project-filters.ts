import type { ProjectStatus } from "@prisma/client";
import {
  parseConstructionManagersJson,
  parseSiteContactsJson,
} from "@/lib/construction-managers";

export type TriStateFilter = "" | "ja" | "nein";
export type PercentOperator = "" | "gt" | "lt";

export function getTriStateFilter(value: string | undefined): TriStateFilter {
  return value === "ja" || value === "nein" ? value : "";
}

export function getPercentOperator(value: string | undefined): PercentOperator {
  return value === "gt" || value === "lt" ? value : "";
}

export function getPercentValue(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeProjectSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  NOT_STARTED: "noch nicht begonnen",
  ACTIVE: "aktiv",
  PAUSED: "ruht",
  FINISHED: "beendet",
  CANCELLED: "storniert",
};

export type ProjectSearchSource = {
  client: string | null;
  constructionManager: string | null;
  constructionManagersJson: string | null;
  finalInvoiceNumber: string | null;
  name: string;
  notes: string | null;
  projectNumber: string;
  siteAddress: string | null;
  siteContactsJson: string | null;
  siteDirectionsNote: string | null;
  status: ProjectStatus;
};

/** Alles, was man beim Anlegen eines Projekts einträgt oder was dort
 * hinterlegt ist, zu einem normalisierten Text zusammengefasst - Basis für
 * die Live-Suche in Projektübersicht und Leistungsmeldung. `extra` nimmt
 * zusätzliche, vom Aufrufer bereits geladene Freitext-Hinweise auf (z.B.
 * zugeordnetes Personal/Geräte), die hier nicht selbst nachgeladen werden.*/
export function buildProjectSearchText(project: ProjectSearchSource, extra: string[] = []) {
  const constructionManagerNames = parseConstructionManagersJson(
    project.constructionManagersJson,
  ).map((entry) => entry.name);
  const siteContacts = parseSiteContactsJson(project.siteContactsJson);

  return normalizeProjectSearchText(
    [
      project.projectNumber,
      project.name,
      project.client,
      project.constructionManager,
      constructionManagerNames.join(" "),
      PROJECT_STATUS_LABELS[project.status],
      project.siteAddress,
      project.siteDirectionsNote,
      project.notes,
      project.finalInvoiceNumber,
      siteContacts
        .map((contact) => `${contact.name} ${contact.phone ?? ""} ${contact.role ?? ""}`)
        .join(" "),
      ...extra,
    ]
      .filter(Boolean)
      .join(" "),
  );
}
