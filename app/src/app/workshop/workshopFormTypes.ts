import {
  parseProjectFormFields,
  type ProjectFormFieldDefinition,
} from "@/app/projects/projectFormTypes";

export type WorkshopFormKind =
  | "VEHICLE_ORDER"
  | "MACHINE_ORDER"
  | "TIRE_ORDER"
  | "CUSTOM";

export type WorkshopFormTemplateItem = {
  category: string | null;
  description: string | null;
  fields: ProjectFormFieldDefinition[];
  id: string;
  kind: WorkshopFormKind;
  name: string;
  paperOrientation: "LANDSCAPE" | "PORTRAIT";
  paperSize: "A4" | "A5";
};

export const BUILT_IN_WORKSHOP_FORMS: WorkshopFormTemplateItem[] = [
  {
    category: "Auftrag",
    description: "Werkstattauftrag für PKW und LKW in der vorhandenen STIX-Vorlage.",
    fields: [],
    id: "builtin:vehicle",
    kind: "VEHICLE_ORDER",
    name: "Fahrzeugauftrag PKW / LKW",
    paperOrientation: "PORTRAIT",
    paperSize: "A4",
  },
  {
    category: "Auftrag",
    description: "Werkstattauftrag für Maschinen und Geräte in der vorhandenen STIX-Vorlage.",
    fields: [],
    id: "builtin:machine",
    kind: "MACHINE_ORDER",
    name: "Maschinenauftrag",
    paperOrientation: "PORTRAIT",
    paperSize: "A4",
  },
  {
    category: "Kontrolle",
    description: "Reifen- und Achskontrolle für Fahrzeuge mit bis zu sechs Achsen.",
    fields: [],
    id: "builtin:tire",
    kind: "TIRE_ORDER",
    name: "Reifenauftrag",
    paperOrientation: "PORTRAIT",
    paperSize: "A4",
  },
];

export function parseWorkshopFormValues(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, boolean | string] =>
          typeof entry[1] === "boolean" || typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

export function parseWorkshopSnapshotFields(
  snapshotJson: string | null | undefined,
  fallbackJson?: string | null,
) {
  if (snapshotJson) {
    try {
      const parsed = JSON.parse(snapshotJson) as { fields?: unknown };
      return parseProjectFormFields(JSON.stringify(parsed.fields ?? []));
    } catch {
      // Fallback below.
    }
  }
  return parseProjectFormFields(fallbackJson);
}
