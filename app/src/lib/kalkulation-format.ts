/** Zeigt bei einem LV-Import bevorzugt Projektnummer + Projektname an
 * (die eigentlich relevante Information für den Nutzer), fällt nur auf den
 * Dateinamen zurück, wenn keins von beidem hinterlegt ist. */
export function formatLvSource(lvImport: { fileName: string; projectNumber: string | null; tenderTitle: string | null }) {
  const projectLabel = [lvImport.projectNumber, lvImport.tenderTitle].filter(Boolean).join(" – ");
  return projectLabel || lvImport.fileName;
}
