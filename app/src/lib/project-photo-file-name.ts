/** Shared by the upload action (actual stored filename - matters because
 * long-press "Save Image"/"Save to Photos" on mobile uses the storage
 * URL's own filename, not any JS `download` attribute) and the gallery's
 * explicit download button, so a photo's name is consistent everywhere:
 * YYYY-MM-DD_HHMMSS_Projektnummer_Nachname[_uniqueSuffix].ext */
export function buildPhotoFileName({
  date,
  extension,
  projectNumber,
  uniqueSuffix,
  uploadedByName,
}: {
  date: Date;
  extension: string;
  projectNumber: string | null;
  uniqueSuffix?: string | null;
  uploadedByName: string | null;
}) {
  const timestamp = formatFileNameTimestamp(date);
  const surname = uploadedByName?.trim().split(/\s+/).pop();
  const parts = [timestamp, projectNumber, surname, uniqueSuffix]
    .filter((part): part is string => Boolean(part))
    .map(sanitizeFileNamePart);

  return `${parts.join("_")}.${extension}`;
}

function sanitizeFileNamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

function formatFileNameTimestamp(date: Date) {
  const parts = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Berlin",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}_${get("hour")}${get("minute")}${get("second")}`;
}
