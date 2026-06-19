export const PROJECT_FORM_FIELD_TYPES = [
  "select",
  "checkbox",
  "photo",
  "masterdata",
  "text",
  "textarea",
  "number",
  "date",
  "time",
  "divider",
  "qrcode",
  "barcode",
  "trafficlight",
  "signature",
  "grade",
  "chart",
  "subform",
  "formula",
  "companydata",
] as const;

export type ProjectFormFieldType = (typeof PROJECT_FORM_FIELD_TYPES)[number];
export type ProjectFormPaperSize = "A4" | "A5";
export type ProjectFormPaperOrientation = "LANDSCAPE" | "PORTRAIT";

export type ProjectFormFieldDefinition = {
  description: string;
  id: string;
  label: string;
  options: string[];
  required: boolean;
  type: ProjectFormFieldType;
  width: number;
};

export function parseProjectFormFields(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizeField(entry))
      .filter((entry): entry is ProjectFormFieldDefinition => Boolean(entry));
  } catch {
    return [];
  }
}

export function getProjectFormFieldTypeLabel(type: ProjectFormFieldType) {
  const labels: Record<ProjectFormFieldType, string> = {
    barcode: "Barcode",
    chart: "Grafik",
    checkbox: "Checkbox",
    companydata: "Firmendaten",
    date: "Datum",
    divider: "Trennlinie",
    formula: "Formel",
    grade: "Noten",
    masterdata: "Stammdatenauswahl",
    number: "Zahleneingabe",
    photo: "Foto",
    qrcode: "QR-Code",
    select: "Auswahlfeld",
    signature: "Unterschrift",
    subform: "Unterformular",
    text: "Texteingabe",
    textarea: "Textfeld",
    time: "Zeit",
    trafficlight: "Ampelbewertung",
  };

  return labels[type];
}

export function projectFormFieldUsesOptions(type: ProjectFormFieldType) {
  return type === "select" || type === "masterdata";
}

export function projectFormFieldCollectsValue(type: ProjectFormFieldType) {
  return type !== "divider" && type !== "companydata";
}

export function getProjectFormPresetOptions(type: ProjectFormFieldType) {
  if (type === "trafficlight") {
    return ["Grün", "Gelb", "Rot"];
  }

  if (type === "grade") {
    return ["1", "2", "3", "4", "5", "6"];
  }

  return [];
}

export function parseProjectFormValues(value: string | null | undefined) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(
          (entry): entry is [string, boolean | string] =>
            typeof entry[1] === "boolean" || typeof entry[1] === "string",
        )
        .map(([key, entryValue]) => [key, entryValue]),
    );
  } catch {
    return {};
  }
}

export function parseProjectFormSnapshotFields(
  snapshotJson: string | null | undefined,
  fallbackFields: ProjectFormFieldDefinition[],
) {
  if (!snapshotJson) {
    return fallbackFields;
  }

  try {
    const parsed = JSON.parse(snapshotJson) as unknown;

    if (!parsed || typeof parsed !== "object" || !("fields" in parsed)) {
      return fallbackFields;
    }

    return parseProjectFormFields(
      JSON.stringify((parsed as { fields?: unknown }).fields ?? []),
    );
  } catch {
    return fallbackFields;
  }
}

export function parseProjectFormSnapshotSettings(
  snapshotJson: string | null | undefined,
  fallback?: {
    paperOrientation?: string | null;
    paperSize?: string | null;
  } | null,
) {
  let snapshot: { paperOrientation?: unknown; paperSize?: unknown } = {};

  if (snapshotJson) {
    try {
      const parsed = JSON.parse(snapshotJson) as unknown;
      if (parsed && typeof parsed === "object") {
        snapshot = parsed as typeof snapshot;
      }
    } catch {
      snapshot = {};
    }
  }

  return {
    paperOrientation:
      snapshot.paperOrientation === "LANDSCAPE" ||
      fallback?.paperOrientation === "LANDSCAPE"
        ? ("LANDSCAPE" as const)
        : ("PORTRAIT" as const),
    paperSize:
      snapshot.paperSize === "A5" || fallback?.paperSize === "A5"
        ? ("A5" as const)
        : ("A4" as const),
  };
}

function normalizeField(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<ProjectFormFieldDefinition>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const type = PROJECT_FORM_FIELD_TYPES.includes(raw.type as ProjectFormFieldType)
    ? (raw.type as ProjectFormFieldType)
    : "text";

  if (!id || !label) {
    return null;
  }

  return {
    description:
      typeof raw.description === "string" ? raw.description.trim() : "",
    id,
    label,
    options: Array.isArray(raw.options)
      ? raw.options
          .filter((option): option is string => typeof option === "string")
          .map((option) => option.trim())
          .filter(Boolean)
      : [],
    required: Boolean(raw.required),
    type,
    width:
      typeof raw.width === "number" &&
      Number.isInteger(raw.width) &&
      raw.width >= 1 &&
      raw.width <= 6
        ? raw.width
        : 6,
  };
}
