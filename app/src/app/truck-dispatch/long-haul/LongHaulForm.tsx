"use client";

import { useActionState } from "react";
import { InitialTruckRows } from "./InitialTruckRows";
import {
  LongHaulAssignmentTypeFields,
  LongHaulConstructionFields,
  type AsphaltOpenPositionForLongHaulForm,
} from "./LongHaulAssignmentTypeFields";

type DriverWithVehicles = {
  id: string;
  firstName: string;
  lastName: string;
  shortcut: string | null;
  vehicleAssignments: {
    isPrimary: boolean;
    vehicle: {
      id: string;
      vehicleNumber: string;
      licensePlate: string | null;
      vehicleType: string;
      category: string;
      asphaltPayloadTons: number;
    };
  }[];
};

type VehicleWithDriver = {
  id: string;
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  asphaltPayloadTons: number;
  driverAssignments: {
    driver: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }[];
};

export type LongHaulFormState = {
  error?: string | null;
  success?: string | null;
};

type LongHaulFormAction = (
  state: LongHaulFormState,
  formData: FormData,
) => Promise<LongHaulFormState>;

const initialFormState: LongHaulFormState = {
  error: null,
  success: null,
};

export function LongHaulForm({
  action,
  id,
  workDate,
  projects,
  materials,
  asphaltMixes,
  asphaltOpenPositions = [],
  showInitialTruckRows = false,
  drivers = [],
  vehicles = [],
  vehicleCategories = [],
  subcontractors = [],
  busyDrivers = new Map<string, string>(),
  busyVehicles = new Map<string, string>(),
  shortDriverConflicts = new Map<string, string>(),
  shortVehicleConflicts = new Map<string, string>(),
  defaultAssignmentType = "CONSTRUCTION",
  defaultMaterialSource = "MATERIAL",
  defaultAsphaltDispatchEntryId = "",
  defaultProjectId = "",
  defaultMaterialTypeId = "",
  defaultAsphaltMixTypeId = "",
  defaultMaterialQuantity = 0,
  defaultNotes = "",
}: {
  action: LongHaulFormAction;
  id?: string;
  workDate?: string;
  projects: {
    id: string;
    projectNumber: string;
    name: string;
    constructionManager: string | null;
  }[];
  materials: {
    id: string;
    name: string;
    unit: string;
    category: string | null;
  }[];
  asphaltMixes: {
    id: string;
    mixNumber: string;
    name: string;
    shortName: string | null;
    unit: string;
    category: string | null;
  }[];
  asphaltOpenPositions?: AsphaltOpenPositionForLongHaulForm[];
  showInitialTruckRows?: boolean;
  drivers?: DriverWithVehicles[];
  vehicles?: VehicleWithDriver[];
  vehicleCategories?: string[];
  subcontractors?: string[];
  busyDrivers?: Map<string, string>;
  busyVehicles?: Map<string, string>;
  shortDriverConflicts?: Map<string, string>;
  shortVehicleConflicts?: Map<string, string>;
  defaultAssignmentType?: string;
  defaultMaterialSource?: "MATERIAL" | "ASPHALT";
  defaultAsphaltDispatchEntryId?: string;
  defaultProjectId?: string;
  defaultMaterialTypeId?: string;
  defaultAsphaltMixTypeId?: string;
  defaultMaterialQuantity?: number;
  defaultNotes?: string;
}) {
  const [formState, formAction, isPending] = useActionState(
    action,
    initialFormState,
  );

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 border-t border-gray-100 pt-3"
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {workDate ? (
        <input type="hidden" name="workDate" value={workDate} />
      ) : null}

      {formState.error ? (
        <div
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900"
          role="alert"
        >
          {formState.error}
        </div>
      ) : null}

      {formState.success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-900">
          {formState.success}
        </div>
      ) : null}

      <LongHaulAssignmentTypeFields
        asphaltOpenPositions={asphaltOpenPositions}
        defaultAssignmentType={defaultAssignmentType}
        defaultAsphaltDispatchEntryId={defaultAsphaltDispatchEntryId}
      />

      <LongHaulConstructionFields
        projects={projects}
        materials={materials}
        asphaltMixes={asphaltMixes}
        defaultAssignmentType={defaultAssignmentType}
        defaultMaterialSource={defaultMaterialSource}
        defaultProjectId={defaultProjectId}
        defaultMaterialTypeId={defaultMaterialTypeId}
        defaultAsphaltMixTypeId={defaultAsphaltMixTypeId}
        defaultMaterialQuantity={defaultMaterialQuantity}
      />

      {showInitialTruckRows ? (
        <InitialTruckRows
          drivers={drivers}
          vehicles={vehicles}
          vehicleCategories={vehicleCategories}
          subcontractors={subcontractors}
          busyDrivers={Object.fromEntries(busyDrivers)}
          busyVehicles={Object.fromEntries(busyVehicles)}
          shortDriverConflicts={Object.fromEntries(shortDriverConflicts)}
          shortVehicleConflicts={Object.fromEntries(shortVehicleConflicts)}
        />
      ) : null}

      <label className="block text-sm font-medium text-gray-700">
        Bemerkung
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className={
          isPending
            ? "rounded-lg bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-600"
            : "rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        }
      >
        {isPending ? "Speichert…" : "Speichern"}
      </button>
    </form>
  );
}
