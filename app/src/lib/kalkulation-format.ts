/** Zeigt bei einem LV-Import bevorzugt Projektnummer + Projektname an
 * (die eigentlich relevante Information für den Nutzer), fällt nur auf den
 * Dateinamen zurück, wenn keins von beidem hinterlegt ist. */
export function formatLvSource(lvImport: { fileName: string; projectNumber: string | null; tenderTitle: string | null }) {
  const projectLabel = [lvImport.projectNumber, lvImport.tenderTitle].filter(Boolean).join(" – ");
  return projectLabel || lvImport.fileName;
}

/** Deutsches Label je matchStatus - gemeinsam für Abgleich-Seite und
 * Exporte, damit ein bestätigtes/zugeordnetes LV auch im Export als
 * solches erkennbar ist, selbst wenn (noch) kein Preis hinterlegt ist. */
export const MATCH_STATUS_LABELS: Record<string, string> = {
  PENDING: "Offen",
  SUGGESTED: "Vorschlag",
  NEEDS_REVIEW: "Prüfen",
  CONFIRMED: "Bestätigt",
  REJECTED: "Abgelehnt",
  NO_MATCH: "Kein Treffer",
};
