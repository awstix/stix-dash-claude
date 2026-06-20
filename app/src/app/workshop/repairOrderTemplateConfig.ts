import type { ProjectFormFieldDefinition } from "@/app/projects/projectFormTypes";

export const WORKSHOP_REPAIR_TEMPLATE_ID = "workshop-repair-order-template";

export const WORKSHOP_REPAIR_SYSTEM_FIELD_IDS = new Set([
  "vehicleId",
  "status",
  "priority",
  "title",
  "description",
  "reportedAt",
  "plannedStart",
  "plannedEnd",
  "assignedTo",
  "notes",
]);

export const DEFAULT_REPAIR_ORDER_FIELDS: ProjectFormFieldDefinition[] = [
  field("vehicleId", "Gerät / Fahrzeug", "select", 3),
  field("status", "Status", "select", 2),
  field("priority", "Priorität", "select", 1),
  field("title", "Titel", "text", 6, true),
  field("description", "Beschreibung", "textarea", 6),
  field("reportedAt", "Gemeldet am", "date", 2),
  field("plannedStart", "Geplant von", "date", 2),
  field("plannedEnd", "Geplant bis", "date", 2),
  field("assignedTo", "Zuständig", "masterdata", 3),
  field("notes", "Bemerkung", "text", 3),
];

function field(
  id: string,
  label: string,
  type: ProjectFormFieldDefinition["type"],
  width: number,
  required = false,
): ProjectFormFieldDefinition {
  return {
    description: "",
    id,
    label,
    options: [],
    required,
    type,
    width,
  };
}
