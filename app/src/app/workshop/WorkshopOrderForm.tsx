import { ActionIcon } from "@/components/ActionIcon";
import { FormSignaturePad } from "@/components/FormSignaturePad";
import { FreeTextCombobox } from "@/components/FreeTextCombobox";
import {
  getProjectFormPresetOptions,
  type ProjectFormFieldDefinition,
} from "@/app/projects/projectFormTypes";
import { WORKSHOP_REPAIR_SYSTEM_FIELD_IDS } from "./repairOrderTemplate";
import { WorkshopStatusFields } from "./WorkshopStatusFields";

const priorityOptions = [
  { label: "Niedrig", value: "LOW" },
  { label: "Normal", value: "NORMAL" },
  { label: "Hoch", value: "HIGH" },
  { label: "Dringend", value: "URGENT" },
];

function formatDateTimeInput(date: Date | null | undefined) {
  if (!date) return "";

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getVehicleLabel(vehicle: {
  licensePlate: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
}) {
  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

export function WorkshopOrderForm({
  action,
  allowCompletionFields = true,
  defaultAssignedTo = "",
  defaultCompletedAt = "",
  defaultCompletedByName = "",
  defaultCustomValues,
  defaultDescription = "",
  defaultInventoryItemId = "",
  defaultNotes = "",
  defaultPlannedEnd = "",
  defaultPlannedStart = "",
  defaultPriority = "NORMAL",
  defaultReportedAt = formatDateTimeInput(new Date()),
  defaultStatus = "OPEN",
  defaultTitle = "",
  defaultVehicleId = "",
  id,
  personnel,
  repairTemplateFields,
  vehicles,
}: {
  action: (formData: FormData) => void | Promise<void>;
  allowCompletionFields?: boolean;
  defaultAssignedTo?: string;
  defaultCompletedAt?: string;
  defaultCompletedByName?: string;
  defaultCustomValues: Record<string, boolean | string>;
  defaultDescription?: string;
  defaultInventoryItemId?: string;
  defaultNotes?: string;
  defaultPlannedEnd?: string;
  defaultPlannedStart?: string;
  defaultPriority?: string;
  defaultReportedAt?: string;
  defaultStatus?: string;
  defaultTitle?: string;
  defaultVehicleId?: string;
  id?: string;
  personnel: { id: string; name: string }[];
  repairTemplateFields: ProjectFormFieldDefinition[];
  vehicles: {
    id: string;
    licensePlate: string | null;
    vehicleNumber: string;
    vehicleType: string;
  }[];
}) {
  const templateFields =
    repairTemplateFields.length > 0
      ? repairTemplateFields
      : [];
  const layout = (id: string, fallbackWidth: number) => {
    const index = templateFields.findIndex((field) => field.id === id);
    const field = index >= 0 ? templateFields[index] : null;
    return {
      field,
      style: {
        gridColumn: `span ${field?.width ?? fallbackWidth}`,
        order: index >= 0 ? index : 100,
      },
    };
  };
  const vehicleLayout = layout("vehicleId", 3);
  const statusLayout = layout("status", 3);
  const priorityLayout = layout("priority", 1);
  const titleLayout = layout("title", 6);
  const descriptionLayout = layout("description", 6);
  const reportedLayout = layout("reportedAt", 2);
  const plannedStartLayout = layout("plannedStart", 2);
  const plannedEndLayout = layout("plannedEnd", 2);
  const assignedLayout = layout("assignedTo", 3);
  const notesLayout = layout("notes", 3);
  const customFields = templateFields.filter(
    (field) => !WORKSHOP_REPAIR_SYSTEM_FIELD_IDS.has(field.id),
  );

  return (
    <form
      action={action}
      className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {defaultInventoryItemId ? (
        <input
          type="hidden"
          name="inventoryItemId"
          value={defaultInventoryItemId}
        />
      ) : null}

      <label className="text-sm font-medium text-gray-800" style={vehicleLayout.style}>
        {vehicleLayout.field?.label ?? "Gerät / Fahrzeug"}
        <select
          name="vehicleId"
          required={vehicleLayout.field?.required}
          defaultValue={defaultVehicleId}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="">Ohne Zuordnung</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {getVehicleLabel(vehicle)}
            </option>
          ))}
        </select>
      </label>

      {!allowCompletionFields ? (
        <>
          <input name="status" type="hidden" value="OPEN" />
          <input name="completedAt" type="hidden" value="" />
          <input name="completedByName" type="hidden" value="" />
        </>
      ) : null}

      <label className="text-sm font-medium text-gray-800" style={priorityLayout.style}>
        {priorityLayout.field?.label ?? "Priorität"}
        <select
          name="priority"
          required={priorityLayout.field?.required}
          defaultValue={defaultPriority}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          {priorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-gray-800" style={titleLayout.style}>
        {titleLayout.field?.label ?? "Titel"}
        <input
          name="title"
          required={titleLayout.field?.required ?? true}
          defaultValue={defaultTitle}
          placeholder="z.B. Hydraulikschlauch undicht, Service fällig..."
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={descriptionLayout.style}>
        {descriptionLayout.field?.label ?? "Beschreibung"}
        <textarea
          name="description"
          required={descriptionLayout.field?.required}
          defaultValue={defaultDescription}
          rows={3}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={reportedLayout.style}>
        {reportedLayout.field?.label ?? "Gemeldet am"}
        <input
          type="datetime-local"
          name="reportedAt"
          required={reportedLayout.field?.required}
          defaultValue={defaultReportedAt}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={plannedStartLayout.style}>
        {plannedStartLayout.field?.label ?? "Geplant von"}
        <input
          type="date"
          name="plannedStart"
          required={plannedStartLayout.field?.required}
          defaultValue={defaultPlannedStart}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={plannedEndLayout.style}>
        {plannedEndLayout.field?.label ?? "Geplant bis"}
        <input
          type="date"
          name="plannedEnd"
          required={plannedEndLayout.field?.required}
          defaultValue={defaultPlannedEnd}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={assignedLayout.style}>
        {assignedLayout.field?.label ?? "Zuständig"}
        <FreeTextCombobox
          name="assignedTo"
          required={assignedLayout.field?.required}
          defaultValue={defaultAssignedTo}
          placeholder="Werkstatt, Mitarbeiter, extern..."
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          options={personnel.map((person) => ({
            id: person.id,
            label: person.name,
          }))}
          suggestionsId={`workshop-personnel-${id ?? (defaultInventoryItemId || "new")}`}
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={notesLayout.style}>
        {notesLayout.field?.label ?? "Bemerkung"}
        <input
          name="notes"
          required={notesLayout.field?.required}
          defaultValue={defaultNotes}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      {customFields.map((field) => (
        <RepairCustomField
          field={field}
          key={field.id}
          value={defaultCustomValues[field.id]}
          order={templateFields.findIndex((item) => item.id === field.id)}
        />
      ))}

      {allowCompletionFields ? (
        <div
          className="grid gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-3 xl:col-span-6"
          style={{ order: 990 }}
        >
          <WorkshopStatusFields
            defaultCompletedByName={defaultCompletedByName}
            defaultCompletedAt={defaultCompletedAt}
            defaultStatus={defaultStatus}
            personnel={personnel}
            statusLabel={statusLayout.field?.label}
          />
        </div>
      ) : null}

      <div className="flex items-end xl:col-span-6" style={{ order: 1000 }}>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
        >
          <ActionIcon name="save" className="h-4 w-4" />
          Speichern
        </button>
      </div>
    </form>
  );
}

function RepairCustomField({
  field,
  order,
  value,
}: {
  field: ProjectFormFieldDefinition;
  order: number;
  value: boolean | string | undefined;
}) {
  const style = {
    gridColumn: `span ${field.width}`,
    order,
  };
  const className =
    "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

  if (field.type === "divider" || field.type === "companydata") {
    return (
      <div className="border-b border-gray-300 pb-2 font-semibold text-gray-900" style={style}>
        {field.label}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 pt-7 text-sm font-medium text-gray-800" style={style}>
        <input
          type="checkbox"
          name={`custom:${field.id}`}
          defaultChecked={value === true}
          className="h-5 w-5"
        />
        {field.label}
      </label>
    );
  }

  if (field.type === "signature") {
    return (
      <div style={style}>
        <FormSignaturePad
          label={field.label}
          name={`custom:${field.id}`}
          required={field.required}
          value={typeof value === "string" ? value : ""}
        />
      </div>
    );
  }

  if (
    field.type === "select" ||
    field.type === "masterdata" ||
    field.type === "trafficlight" ||
    field.type === "grade"
  ) {
    const options =
      field.options.length > 0
        ? field.options
        : getProjectFormPresetOptions(field.type);
    return (
      <label className="text-sm font-medium text-gray-800" style={style}>
        {field.label}
        <select
          name={`custom:${field.id}`}
          defaultValue={String(value ?? "")}
          required={field.required}
          className={className}
        >
          <option value="">Bitte auswählen</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  if (
    field.type === "textarea" ||
    field.type === "chart" ||
    field.type === "subform"
  ) {
    return (
      <label className="text-sm font-medium text-gray-800" style={style}>
        {field.label}
        <textarea
          name={`custom:${field.id}`}
          defaultValue={String(value ?? "")}
          required={field.required}
          rows={3}
          className={className}
        />
      </label>
    );
  }

  const inputType = ["date", "time", "number"].includes(field.type)
    ? field.type
    : "text";
  return (
    <label className="text-sm font-medium text-gray-800" style={style}>
      {field.label}
      <input
        type={inputType}
        name={`custom:${field.id}`}
        defaultValue={String(value ?? "")}
        required={field.required}
        className={className}
      />
    </label>
  );
}
