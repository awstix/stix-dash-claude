"use client";

import { useMemo, useState } from "react";

type VehicleOption = {
  id: string;
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  tackCoatTankLiters: number;
};

type DriverOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type ProjectOption = {
  id: string;
  projectNumber: string;
  name: string;
};

type CrewOption = {
  id: string;
  name: string;
};

type TackCoatMaterialOption = {
  id: string;
  materialNumber: string | null;
  name: string;
  unit: string;
};

type TackCoatNeed = {
  key: string;
  workDate: string;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  materialName: string;
  quantity: number;
  quantityUnit: string;
  plannedQuantity: number;
  specialVehicleQuantity: number;
  shortHaulQuantity: number;
  openQuantity: number;
  crewName: string;
};

type TourRow = {
  id: number;
  projectId: string;
  startTime: string;
  endTime: string;
  taskText: string;
  materialName: string;
  quantity: string;
  quantityUnit: string;
  notes: string;
};

function getVehicleLabel(vehicle: VehicleOption) {
  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.category, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

function formatNumber(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getSuggestedQuantity(openQuantity: number, tankLiters: number) {
  if (tankLiters <= 0) return openQuantity;
  return Math.min(openQuantity, tankLiters);
}

function getDefaultRows(needs: TackCoatNeed[], workDate: string, tankLiters = 0) {
  const needsForDay = needs.filter((need) => need.workDate === workDate && need.openQuantity > 0);

  if (needsForDay.length > 0) {
    return needsForDay.slice(0, 3).map((need, index): TourRow => {
      const startHour = 7 + index * 2;
      const endHour = startHour + 2;
      const suggestedQuantity = getSuggestedQuantity(need.openQuantity, tankLiters);

      return {
        id: index,
        projectId: need.projectId ?? "",
        startTime: `${String(startHour).padStart(2, "0")}:00`,
        endTime: `${String(endHour).padStart(2, "0")}:00`,
        taskText: "Anspritzen",
        materialName: need.materialName,
        quantity: String(suggestedQuantity),
        quantityUnit: need.quantityUnit,
        notes: `Vorschlag aus Asphaltdisposition: ${formatNumber(need.quantity)} ${need.quantityUnit} ${need.materialName}${tankLiters > 0 ? ` · Arbeitsmitteltank ${formatNumber(tankLiters)} l` : ""}`,
      };
    });
  }

  return [0, 1, 2].map((index): TourRow => {
    const startHour = 7 + index * 2;
    const endHour = startHour + 2;

    return {
      id: index,
      projectId: "",
      startTime: `${String(startHour).padStart(2, "0")}:00`,
      endTime: `${String(endHour).padStart(2, "0")}:00`,
      taskText: "",
      materialName: "",
      quantity: "",
      quantityUnit: "",
      notes: "",
    };
  });
}

export function SpecialVehicleTourFormClient({
  action,
  vehicles,
  transportVehicles,
  drivers,
  projects,
  crews,
  defaultVehicleId,
  defaultWorkDate,
  tackCoatNeeds,
  tackCoatMaterials,
}: {
  action: (formData: FormData) => Promise<void>;
  vehicles: VehicleOption[];
  transportVehicles: VehicleOption[];
  drivers: DriverOption[];
  projects: ProjectOption[];
  crews: CrewOption[];
  defaultVehicleId: string;
  defaultWorkDate: string;
  tackCoatNeeds: TackCoatNeed[];
  tackCoatMaterials: TackCoatMaterialOption[];
}) {
  const initialVehicle = vehicles.find((vehicle) => vehicle.id === defaultVehicleId);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [workDate, setWorkDate] = useState(defaultWorkDate);
  const [rows, setRows] = useState<TourRow[]>(() =>
    getDefaultRows(tackCoatNeeds, defaultWorkDate, initialVehicle?.tackCoatTankLiters ?? 0),
  );

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === vehicleId),
    [vehicleId, vehicles],
  );

  const needsForSelectedDay = useMemo(
    () => tackCoatNeeds.filter((need) => need.workDate === workDate),
    [tackCoatNeeds, workDate],
  );

  const needByProject = useMemo(() => {
    const map = new Map<string, TackCoatNeed>();

    for (const need of needsForSelectedDay) {
      if (!need.projectId || map.has(need.projectId)) {
        continue;
      }

      map.set(need.projectId, need);
    }

    return map;
  }, [needsForSelectedDay]);

  const tackCoatUnitByName = useMemo(() => {
    const map = new Map<string, string>();

    for (const material of tackCoatMaterials) {
      map.set(material.name, material.unit);
    }

    return map;
  }, [tackCoatMaterials]);

  function handleMaterialChange(row: TourRow, materialName: string) {
    const unit = tackCoatUnitByName.get(materialName);

    updateRow(row.id, {
      materialName,
      quantityUnit: materialName && unit ? unit : row.quantityUnit,
    });
  }

  function updateRow(rowId: number, patch: Partial<TourRow>) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }

  function handleProjectChange(row: TourRow, projectId: string) {
    const need = needByProject.get(projectId);

    if (!need) {
      updateRow(row.id, { projectId });
      return;
    }

    updateRow(row.id, {
      projectId,
      taskText: row.taskText || "Anspritzen",
      materialName: need.materialName,
      quantity:
        need.openQuantity > 0
          ? String(getSuggestedQuantity(need.openQuantity, selectedVehicle?.tackCoatTankLiters ?? 0))
          : String(need.quantity),
      quantityUnit: need.quantityUnit,
      notes:
        row.notes ||
        `Vorschlag aus Asphaltdisposition: ${formatNumber(need.quantity)} ${need.quantityUnit} ${need.materialName}${
          selectedVehicle?.tackCoatTankLiters ? ` · Arbeitsmitteltank ${formatNumber(selectedVehicle.tackCoatTankLiters)} l` : ""
        }`,
    });
  }

  function addRow() {
    setRows((currentRows) => {
      const lastRow = currentRows[currentRows.length - 1];
      const nextId = currentRows.reduce((max, row) => Math.max(max, row.id), -1) + 1;
      const startTime = lastRow?.endTime || "07:00";
      const [hourText] = startTime.split(":");
      const endHour = Math.min(Number(hourText || "7") + 2, 17);

      return [
        ...currentRows,
        {
          id: nextId,
          projectId: "",
          startTime,
          endTime: `${String(endHour).padStart(2, "0")}:00`,
          taskText: "",
          materialName: "",
          quantity: "",
          quantityUnit: "",
          notes: "",
        },
      ];
    });
  }

  function removeRow(rowId: number) {
    setRows((currentRows) =>
      currentRows.length <= 1 ? currentRows : currentRows.filter((row) => row.id !== rowId),
    );
  }

  return (
    <form action={action} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <label className="text-xs font-semibold text-gray-700">
          Sonderfahrzeug
          <select
            name="vehicleId"
            required
            value={vehicleId}
            onChange={(event) => {
              const nextVehicleId = event.currentTarget.value;
              const nextVehicle = vehicles.find((vehicle) => vehicle.id === nextVehicleId);
              setVehicleId(nextVehicleId);
              setRows(getDefaultRows(tackCoatNeeds, workDate, nextVehicle?.tackCoatTankLiters ?? 0));
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="" disabled>
              Fahrzeug wählen
            </option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {getVehicleLabel(vehicle)}
                {vehicle.tackCoatTankLiters > 0 ? ` · Arbeitsmitteltank ${formatNumber(vehicle.tackCoatTankLiters)} l` : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] font-medium text-blue-700">
            Arbeitsmitteltank:{" "}
            {selectedVehicle
              ? selectedVehicle.tackCoatTankLiters > 0
                ? `${formatNumber(selectedVehicle.tackCoatTankLiters)} l`
                : "nicht hinterlegt"
              : "Spritzwagen wählen"}
          </span>
        </label>

        <label className="text-xs font-semibold text-gray-700">
          Transport-LKW optional
          <select
            name="transportVehicleId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Kein Transport-LKW</option>
            {transportVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {getVehicleLabel(vehicle)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-gray-700">
          Fahrer/Bediener optional
          <select
            name="operatorDriverId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Kein Fahrer/Bediener</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.lastName}, {driver.firstName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-gray-700">
          Datum
          <input
            type="date"
            name="workDate"
            required
            value={workDate}
            onChange={(event) => {
              const nextDate = event.currentTarget.value;
              setWorkDate(nextDate);
              setRows(getDefaultRows(tackCoatNeeds, nextDate));
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-xs font-semibold text-gray-700">
          Kolonne optional
          <select
            name="crewId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Keine Kolonne</option>
            {crews.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-950">
        Arbeitsmitteltank aus Fahrzeugstamm:{" "}
        {selectedVehicle
          ? selectedVehicle.tackCoatTankLiters > 0
            ? `${formatNumber(selectedVehicle.tackCoatTankLiters)} l`
            : "nicht im Fahrzeugstamm hinterlegt"
          : "bitte Spritzwagen wählen"}
      </div>

      {needsForSelectedDay.length > 0 ? (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-950">
          <div className="font-bold">Vorgeplante Anspritzmittel aus Asphaltdisposition</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {needsForSelectedDay.map((need) => (
              <span key={need.key} className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm">
                {need.projectNumber} · offen {formatNumber(need.openQuantity)} {need.quantityUnit} {need.materialName}
                {need.specialVehicleQuantity || need.shortHaulQuantity
                  ? ` · Spritzwagen ${formatNumber(need.specialVehicleQuantity)} · Kurzstrecke ${formatNumber(need.shortHaulQuantity)}`
                  : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-gray-900">Tour {index + 1}</div>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Entfernen
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <label className="text-xs font-semibold text-gray-700 md:col-span-2">
                Baustelle
                <select
                  name={`tourProjectId_${row.id}`}
                  value={row.projectId}
                  onChange={(event) => handleProjectChange(row, event.currentTarget.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">Baustelle wählen</option>
                  {projects.map((project) => {
                    const need = needByProject.get(project.id);

                    return (
                      <option key={project.id} value={project.id}>
                        {project.projectNumber} · {project.name}
                        {need
                          ? ` · offen ${formatNumber(need.openQuantity)} ${need.quantityUnit} ${need.materialName}`
                          : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="text-xs font-semibold text-gray-700">
                Beginn
                <input
                  name={`tourStartTime_${row.id}`}
                  value={row.startTime}
                  onChange={(event) => updateRow(row.id, { startTime: event.currentTarget.value })}
                  placeholder="07:00"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="text-xs font-semibold text-gray-700">
                Ende
                <input
                  name={`tourEndTime_${row.id}`}
                  value={row.endTime}
                  onChange={(event) => updateRow(row.id, { endTime: event.currentTarget.value })}
                  placeholder="09:00"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="text-xs font-semibold text-gray-700 md:col-span-2">
                Aufgabe
                <input
                  name={`tourTaskText_${row.id}`}
                  value={row.taskText}
                  onChange={(event) => updateRow(row.id, { taskText: event.currentTarget.value })}
                  placeholder="Anspritzen, Tieflader, Kehren"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="text-xs font-semibold text-gray-700 md:col-span-2">
                Anspritzmittel / Mittel
                <select
                  name={`tourMaterialName_${row.id}`}
                  value={row.materialName}
                  onChange={(event) => handleMaterialChange(row, event.currentTarget.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">Kein Anspritzmittel / anderer Einsatz</option>
                  {tackCoatMaterials.map((material) => (
                    <option key={material.id} value={material.name}>
                      {[material.materialNumber, material.name].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-gray-700">
                Anspritzmenge dieser Tour
                <input
                  name={`tourQuantity_${row.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.quantity}
                  onChange={(event) => updateRow(row.id, { quantity: event.currentTarget.value })}
                  placeholder="850"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="text-xs font-semibold text-gray-700">
                Einheit
                <input
                  name={`tourQuantityUnit_${row.id}`}
                  value={row.quantityUnit}
                  onChange={(event) => updateRow(row.id, { quantityUnit: event.currentTarget.value })}
                  placeholder="kg, l"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="text-xs font-semibold text-gray-700 md:col-span-2">
                Bemerkung
                <input
                  name={`tourNotes_${row.id}`}
                  value={row.notes}
                  onChange={(event) => updateRow(row.id, { notes: event.currentTarget.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Weitere Tour hinzufügen
        </button>

        <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
          Touren speichern
        </button>
      </div>
    </form>
  );
}
