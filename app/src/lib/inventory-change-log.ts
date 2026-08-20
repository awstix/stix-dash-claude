import { prisma } from "@/lib/prisma";

/** German label for each editable InventoryItem field worth tracking in
 * the change log. Fields not listed here are silently skipped (mostly
 * internal/derived ones like sourceType/sourceId/constructionYear, or
 * ones paired with a *Label field that already carries the same info). */
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  manufacturer: "Hersteller",
  model: "Typ/Modell",
  serialNumber: "Seriennummer",
  vehicleIdentNumber: "Fahrgestellnummer",
  licensePlate: "Kennzeichen",
  objectNumber: "Objekt-ID",
  inventoryNumber: "Inventarnummer",
  stixId: "STIX-ID",
  categoryId: "Kategorie",
  constructionDate: "Produktionsdatum / Baujahr",
  firstRegistrationDate: "Erstzulassung",
  receivedAt: "Erhalten am",
  purchasedAt: "Gekauft am",
  purchasedFrom: "Gekauft von",
  invoiceNumber: "Rechnungsnummer",
  deliveryNoteNumber: "Lieferscheinnummer",
  axleCount: "Achsen",
  grossWeightKg: "Zul. Gesamtmasse (F1)",
  payloadKg: "Nutzlast",
  driveType: "Antrieb",
  attachmentType: "Aufnahmetyp",
  fuelTypeLabel: "Kraftstoffart",
  fuelTankLiters: "Kraftstofftank",
  workMaterialTankLiters: "Arbeitsmitteltank",
  isContainer: "Containerobjekt",
  isStockManaged: "Bestandsverwaltung",
  currentStock: "Aktueller Bestand",
  stockUnit: "Einheit",
  responsibleType: "Verantwortlich (Typ)",
  responsibleEmployeeId: "Verantwortlicher Mitarbeiter",
  responsibleCrewId: "Verantwortliche Kolonne",
  currentProjectId: "Aktuelles Projekt",
  parentItemId: "Übergeordnetes Objekt",
  billingRateCents: "Verrechnungssatz",
  billingRateUnit: "Verrechnungssatz Einheit",
  idleBillingRateCents: "Verrechnungssatz stillgelegt",
  idleBillingRateUnit: "Verrechnungssatz stillgelegt Einheit",
  insuranceProviderLabel: "Versichert bei",
  insuranceAnnualPremiumCents: "Versicherung p.a.",
  notes: "Bemerkung",
  status: "Status",
  lastServiceAtDate: "Letzter Service",
  lastServiceMileageKm: "Letzter Service KM",
  lastServiceOperatingHours: "Letzter Service Betriebsstunden",
  nextServiceAtDate: "Nächster Service",
  nextServiceMileageKm: "Nächster Service KM",
  nextServiceOperatingHours: "Nächster Service Betriebsstunden",
  lastDguvInspectionDate: "Letzte DGUV",
  nextDguvInspectionDate: "Nächste DGUV",
  lastTuvInspectionDate: "Letzte TÜV",
  nextTuvInspectionDate: "Nächste TÜV",
  lastHuInspectionDate: "Letzte HU",
  nextHuInspectionDate: "Nächste HU",
  lastTachographInspectionDate: "Letzte Tachograf-Prüfung",
  nextTachographInspectionDate: "Nächste Tachograf-Prüfung",
  lastSafetyInspectionDate: "Letzte SP",
  nextSafetyInspectionDate: "Nächste SP",
  lastAdrInspectionDate: "Letzte ADR",
  nextAdrInspectionDate: "Nächste ADR",
};

const centsFields = new Set([
  "billingRateCents",
  "idleBillingRateCents",
  "insuranceAnnualPremiumCents",
]);
const booleanFields = new Set(["isContainer", "isStockManaged"]);
const unitFields = new Set(["billingRateUnit", "idleBillingRateUnit"]);

const relationLookups: Record<string, (id: string) => Promise<string | null>> = {
  categoryId: async (id) =>
    (await prisma.inventoryCategory.findUnique({ select: { name: true }, where: { id } }))
      ?.name ?? null,
  currentProjectId: async (id) => {
    const project = await prisma.project.findUnique({
      select: { name: true, projectNumber: true },
      where: { id },
    });
    return project ? `${project.projectNumber} · ${project.name}` : null;
  },
  parentItemId: async (id) =>
    (await prisma.inventoryItem.findUnique({ select: { name: true }, where: { id } }))?.name ??
    null,
  responsibleCrewId: async (id) =>
    (await prisma.crew.findUnique({ select: { name: true }, where: { id } }))?.name ?? null,
  responsibleEmployeeId: async (id) => {
    const employee = await prisma.employee.findUnique({
      select: { firstName: true, lastName: true },
      where: { id },
    });
    return employee ? `${employee.firstName} ${employee.lastName}` : null;
  },
};

function valuesEqual(a: unknown, b: unknown) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) return false;
  return a === b;
}

function formatPlainValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return new Intl.DateTimeFormat("de-DE").format(value);
  if (centsFields.has(key)) return `${(Number(value) / 100).toFixed(2)} €`;
  if (booleanFields.has(key)) return value ? "Ja" : "Nein";
  if (unitFields.has(key)) return value === "DAY" ? "je Tag" : "je Stunde";
  return String(value);
}

async function formatFieldValue(key: string, value: unknown): Promise<string> {
  const lookup = relationLookups[key];
  if (!lookup) return formatPlainValue(key, value);
  if (value === null || value === undefined) return "—";
  return (await lookup(String(value))) ?? "—";
}

/** Diffs the existing DB row against the new save payload for every field
 * in FIELD_LABELS, returns a human-readable multi-line summary of what
 * changed (or null if nothing tracked changed). */
export async function buildInventoryItemChangeSummary(
  before: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const lines: string[] = [];

  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    if (!(key in payload)) continue;

    const oldValue = before[key];
    const newValue = payload[key];
    if (valuesEqual(oldValue, newValue)) continue;

    const [oldDisplay, newDisplay] = await Promise.all([
      formatFieldValue(key, oldValue),
      formatFieldValue(key, newValue),
    ]);
    lines.push(`${label}: ${oldDisplay} → ${newDisplay}`);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}
