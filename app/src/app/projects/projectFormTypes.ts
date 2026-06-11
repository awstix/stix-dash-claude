export const PROJECT_FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "time",
  "checkbox",
  "select",
] as const;

export type ProjectFormFieldType = (typeof PROJECT_FORM_FIELD_TYPES)[number];

export type ProjectFormFieldDefinition = {
  id: string;
  label: string;
  options: string[];
  required: boolean;
  type: ProjectFormFieldType;
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
    checkbox: "Ja/Nein",
    date: "Datum",
    number: "Zahl",
    select: "Auswahl",
    text: "Text",
    textarea: "Langtext",
    time: "Uhrzeit",
  };

  return labels[type];
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
  };
}
