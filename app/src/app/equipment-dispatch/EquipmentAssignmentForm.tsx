"use client";

import { useState, type FormEvent } from "react";
import { SearchableSelect } from "./SearchableSelect";
import { getEquipmentVehicleSelectLabel } from "./equipment-vehicle-labels";

export function EquipmentAssignmentForm({
  action,
  id,
  vehicles,
  projects,
  crews,
  defaultVehicleId = "",
  fixedVehicleId,
  fixedVehicleLabel,
  defaultProjectId = "",
  defaultCrewId = "",
  defaultStartDate,
  defaultEndDate,
  defaultNotes = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  vehicles: {
    id: string;
    inventoryItemId: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
  projects: {
    id: string;
    projectNumber: string;
    name: string;
  }[];
  crews: {
    id: string;
    name: string;
  }[];
  defaultVehicleId?: string;
  fixedVehicleId?: string;
  fixedVehicleLabel?: string;
  defaultProjectId?: string;
  defaultCrewId?: string;
  defaultStartDate: string;
  defaultEndDate: string;
  defaultNotes?: string;
}) {
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === defaultVehicleId);
  const selectedInventoryItemId = selectedVehicle?.inventoryItemId ?? "";

  // SearchableSelect's actual value lives in a hidden input rather than a
  // native <select>, so it can't rely on the browser's own "required"
  // validation/focus - tracked here instead so a missing required field
  // shows a clear inline message instead of either silently submitting an
  // empty value or letting the server throw into a generic error page.
  const [vehicleValue, setVehicleValue] = useState(selectedInventoryItemId);
  const [projectValue, setProjectValue] = useState(defaultProjectId);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!fixedVehicleId && !vehicleValue) {
      event.preventDefault();
      setValidationError("Bitte ein Gerät / eine Maschine auswählen.");
      return;
    }
    if (!projectValue) {
      event.preventDefault();
      setValidationError("Bitte eine Baustelle auswählen.");
      return;
    }
    setValidationError(null);
  }

  return (
    <form
      action={action}
      className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2"
      onSubmit={handleSubmit}
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}

      {validationError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 md:col-span-2">
          {validationError}
        </div>
      ) : null}

      {fixedVehicleId ? (
        <label className="block text-sm font-medium text-gray-800">
          Gerät / Maschine
          <input type="hidden" name="vehicleId" value={fixedVehicleId} />
          <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
            {fixedVehicleLabel ?? "festes Gerät"}
          </div>
        </label>
      ) : (
        <label className="block text-sm font-medium text-gray-800">
          Gerät / Maschine
          <SearchableSelect
            defaultValue={selectedInventoryItemId}
            name="inventoryItemId"
            onValueChange={setVehicleValue}
            options={vehicles.map((vehicle) => ({
              label: getEquipmentVehicleSelectLabel(vehicle),
              value: vehicle.inventoryItemId,
            }))}
            placeholderOption="Inventarobjekt wählen"
            required
            searchPlaceholder="Gerät suchen..."
          />
        </label>
      )}

      <label className="block text-sm font-medium text-gray-800">
        Baustelle
        <SearchableSelect
          defaultValue={defaultProjectId}
          name="projectId"
          onValueChange={setProjectValue}
          options={projects.map((project) => ({
            label: `${project.projectNumber} · ${project.name}`,
            value: project.id,
          }))}
          placeholderOption="Baustelle wählen"
          required
          searchPlaceholder="Baustelle suchen..."
        />
      </label>

      <label className="block text-sm font-medium text-gray-800">
        Kolonne / Polier optional
        <SearchableSelect
          defaultValue={defaultCrewId}
          name="crewId"
          options={[
            { label: "Keine Kolonne gewählt", value: "" },
            ...crews.map((crew) => ({ label: crew.name, value: crew.id })),
          ]}
          searchPlaceholder="Kolonne suchen..."
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-gray-800">
          Von
          <input
            name="startDate"
            type="date"
            required
            defaultValue={defaultStartDate}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="block text-sm font-medium text-gray-800">
          Bis
          <input
            name="endDate"
            type="date"
            required
            defaultValue={defaultEndDate}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-gray-800 md:col-span-2">
        Bemerkung
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}
