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

  return (
    <form
      action={action}
      className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}

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
          <select
            name="inventoryItemId"
            required
            defaultValue={selectedInventoryItemId}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="" disabled>
              Inventarobjekt wählen
            </option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.inventoryItemId}>
                {getEquipmentVehicleSelectLabel(vehicle)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm font-medium text-gray-800">
        Baustelle
        <select
          name="projectId"
          required
          defaultValue={defaultProjectId}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="" disabled>
            Baustelle wählen
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectNumber} · {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-gray-800">
        Kolonne / Polier optional
        <select
          name="crewId"
          defaultValue={defaultCrewId}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="">Keine Kolonne gewählt</option>
          {crews.map((crew) => (
            <option key={crew.id} value={crew.id}>
              {crew.name}
            </option>
          ))}
        </select>
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
