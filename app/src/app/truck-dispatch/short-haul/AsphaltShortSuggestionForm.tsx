"use client";

import { useEffect, useMemo, useState } from "react";
import { createAsphaltLoadAllocationBatch } from "../asphalt-load-actions";

type VehicleOption = {
  id: string;
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  asphaltPayloadTons: number;
  driverAssignments?: {
    driver: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }[];
};

type DriverOption = {
  id: string;
  firstName: string;
  lastName: string;
  vehicleAssignments: {
    isPrimary: boolean;
    vehicle: VehicleOption;
  }[];
};

type AsphaltPosition = {
  asphaltDispatchEntryId: string;
  openTons: number;
  isFullyAllocated: boolean;
};

type BusyMap = Record<string, string>;

type SuggestionRow = {
  rowId: number;
  driverId: string;
  vehicleId: string;
  tourCount: string;
  tonsPerTour: string;
  startTime: string;
  endTime: string;
};

type RowCalculation = {
  capacityTons: number;
  allocatedTons: number;
  overCapacityTons: number;
  remainingBefore: number;
  remainingAfter: number;
};

const defaultStartTime = "06:30";
const defaultEndTime = "17:00";

function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseNumber(value: string) {
  const number = Number(String(value).replace(",", "."));
  return Number.isNaN(number) ? 0 : number;
}

function roundTons(value: number) {
  return Math.round(value * 100) / 100;
}

function getVehicleLabel(vehicle: VehicleOption) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.category,
    vehicle.vehicleType,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getDriverLabel(driver: DriverOption | undefined) {
  if (!driver) {
    return "";
  }

  return `${driver.lastName}, ${driver.firstName}`;
}

function getPrimaryVehicle(driver: DriverOption | undefined) {
  if (!driver) return undefined;

  return (
    driver.vehicleAssignments.find((assignment) => assignment.isPrimary)
      ?.vehicle ?? driver.vehicleAssignments[0]?.vehicle
  );
}

function getAssignedDriverForVehicle({
  vehicle,
  drivers,
}: {
  vehicle: VehicleOption;
  drivers: DriverOption[];
}) {
  const directAssignedDriver = vehicle.driverAssignments?.[0]?.driver;

  if (directAssignedDriver) {
    return drivers.find((driver) => driver.id === directAssignedDriver.id) ?? null;
  }

  return (
    drivers.find((driver) => {
      const primaryVehicle = getPrimaryVehicle(driver);
      return primaryVehicle?.id === vehicle.id;
    }) ?? null
  );
}

function getRowCalculation({
  row,
  remainingBefore,
}: {
  row: SuggestionRow;
  remainingBefore: number;
}): RowCalculation {
  const tourCount = Math.max(1, Number.parseInt(row.tourCount || "1", 10) || 1);
  const tonsPerTour = Math.max(0, parseNumber(row.tonsPerTour));
  const capacityTons = roundTons(tourCount * tonsPerTour);
  const allocatedTons = roundTons(Math.min(capacityTons, remainingBefore));
  const overCapacityTons = roundTons(Math.max(0, capacityTons - remainingBefore));
  const remainingAfter = roundTons(Math.max(0, remainingBefore - allocatedTons));

  return {
    capacityTons,
    allocatedTons,
    overCapacityTons,
    remainingBefore,
    remainingAfter,
  };
}

function buildSuggestedRow({
  rowId,
  openTons,
  drivers,
  vehicles,
  driverConflicts,
  vehicleConflicts,
  excludedDriverIds,
  excludedVehicleIds,
}: {
  rowId: number;
  openTons: number;
  drivers: DriverOption[];
  vehicles: VehicleOption[];
  driverConflicts: BusyMap;
  vehicleConflicts: BusyMap;
  excludedDriverIds: Set<string>;
  excludedVehicleIds: Set<string>;
}) {
  if (openTons <= 0) {
    return null;
  }

  const suggestions = vehicles
    .filter((vehicle) => vehicle.asphaltPayloadTons > 0)
    .filter((vehicle) => !vehicleConflicts[vehicle.id])
    .filter((vehicle) => !excludedVehicleIds.has(vehicle.id))
    .map((vehicle) => {
      const assignedDriver = getAssignedDriverForVehicle({ vehicle, drivers });

      if (!assignedDriver) {
        return null;
      }

      if (driverConflicts[assignedDriver.id] || excludedDriverIds.has(assignedDriver.id)) {
        return null;
      }

      const payloadTons = roundTons(vehicle.asphaltPayloadTons);
      const tourCount = Math.max(1, Math.ceil(openTons / payloadTons));
      const capacityTons = roundTons(tourCount * payloadTons);
      const overCapacityTons = roundTons(Math.max(0, capacityTons - openTons));

      return {
        row: {
          rowId,
          driverId: assignedDriver.id,
          vehicleId: vehicle.id,
          tourCount: String(tourCount),
          tonsPerTour: String(payloadTons),
          startTime: defaultStartTime,
          endTime: defaultEndTime,
        } satisfies SuggestionRow,
        tourCount,
        payloadTons,
        overCapacityTons,
        vehicleLabel: getVehicleLabel(vehicle),
      };
    })
    .filter((suggestion): suggestion is NonNullable<typeof suggestion> => suggestion !== null)
    .sort((a, b) => {
      if (a.tourCount !== b.tourCount) return a.tourCount - b.tourCount;
      if (a.overCapacityTons !== b.overCapacityTons) {
        return a.overCapacityTons - b.overCapacityTons;
      }
      if (a.payloadTons !== b.payloadTons) return b.payloadTons - a.payloadTons;
      return a.vehicleLabel.localeCompare(b.vehicleLabel, "de-DE");
    });

  return suggestions[0]?.row ?? null;
}

function createEmptyRow(rowId: number): SuggestionRow {
  return {
    rowId,
    driverId: "",
    vehicleId: "",
    tourCount: "1",
    tonsPerTour: "",
    startTime: defaultStartTime,
    endTime: defaultEndTime,
  };
}

export function AsphaltShortSuggestionForm({
  workDate,
  position,
  drivers,
  vehicles,
  driverConflicts = {},
  vehicleConflicts = {},
}: {
  workDate: string;
  position: AsphaltPosition;
  drivers: DriverOption[];
  vehicles: VehicleOption[];
  driverConflicts?: BusyMap;
  vehicleConflicts?: BusyMap;
}) {
  const firstSuggestedRow = useMemo(
    () =>
      buildSuggestedRow({
        rowId: 0,
        openTons: position.openTons,
        drivers,
        vehicles,
        driverConflicts,
        vehicleConflicts,
        excludedDriverIds: new Set<string>(),
        excludedVehicleIds: new Set<string>(),
      }),
    [position.openTons, drivers, vehicles, driverConflicts, vehicleConflicts],
  );

  const [rows, setRows] = useState<SuggestionRow[]>(
    firstSuggestedRow ? [firstSuggestedRow] : [createEmptyRow(0)],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRows(firstSuggestedRow ? [firstSuggestedRow] : [createEmptyRow(0)]);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [position.asphaltDispatchEntryId, position.openTons, firstSuggestedRow]);

  const rowsWithCalculations = useMemo(() => {
    return rows.reduce<{
      items: {
        row: SuggestionRow;
        calculation: RowCalculation;
      }[];
      remaining: number;
    }>(
      (accumulator, row) => {
        const calculation = getRowCalculation({
          row,
          remainingBefore: accumulator.remaining,
        });

        return {
          items: [
            ...accumulator.items,
            {
              row,
              calculation,
            },
          ],
          remaining: calculation.remainingAfter,
        };
      },
      {
        items: [],
        remaining: roundTons(position.openTons),
      },
    ).items;
  }, [position.openTons, rows]);

  const allocatedTotal = rowsWithCalculations.reduce(
    (sum, item) => sum + item.calculation.allocatedTons,
    0,
  );

  const remainingAfterRows = roundTons(
    Math.max(0, position.openTons - allocatedTotal),
  );

  const selectedDriverIds = new Set(rows.map((row) => row.driverId).filter(Boolean));
  const selectedVehicleIds = new Set(rows.map((row) => row.vehicleId).filter(Boolean));

  const nextSuggestedRow = buildSuggestedRow({
    rowId: rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.rowId)) + 1,
    openTons: remainingAfterRows,
    drivers,
    vehicles,
    driverConflicts,
    vehicleConflicts,
    excludedDriverIds: selectedDriverIds,
    excludedVehicleIds: selectedVehicleIds,
  });

  function updateRow(rowId: number, patch: Partial<SuggestionRow>) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(rowId: number) {
    setRows((currentRows) =>
      currentRows.length === 1
        ? currentRows
        : currentRows.filter((row) => row.rowId !== rowId),
    );
  }

  function handleDriverChange(rowId: number, driverId: string) {
    const driver = drivers.find((item) => item.id === driverId);
    const primaryVehicle = getPrimaryVehicle(driver);

    if (
      primaryVehicle &&
      primaryVehicle.asphaltPayloadTons > 0 &&
      !vehicleConflicts[primaryVehicle.id] &&
      !rows.some((row) => row.rowId !== rowId && row.vehicleId === primaryVehicle.id)
    ) {
      const rowInfo = rowsWithCalculations.find((item) => item.row.rowId === rowId);
      const remainingBefore = rowInfo?.calculation.remainingBefore ?? position.openTons;

      updateRow(rowId, {
        driverId,
        vehicleId: primaryVehicle.id,
        tonsPerTour: String(primaryVehicle.asphaltPayloadTons),
        tourCount: String(
          Math.max(1, Math.ceil(remainingBefore / primaryVehicle.asphaltPayloadTons)),
        ),
      });
      return;
    }

    updateRow(rowId, { driverId });
  }

  function handleVehicleChange(rowId: number, vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    const assignedDriver = vehicle
      ? getAssignedDriverForVehicle({ vehicle, drivers })
      : null;

    const rowInfo = rowsWithCalculations.find((item) => item.row.rowId === rowId);
    const remainingBefore = rowInfo?.calculation.remainingBefore ?? position.openTons;

    updateRow(rowId, {
      vehicleId,
      driverId:
        assignedDriver &&
        !driverConflicts[assignedDriver.id] &&
        !rows.some((row) => row.rowId !== rowId && row.driverId === assignedDriver.id)
          ? assignedDriver.id
          : rows.find((row) => row.rowId === rowId)?.driverId ?? "",
      tonsPerTour:
        vehicle && vehicle.asphaltPayloadTons > 0
          ? String(vehicle.asphaltPayloadTons)
          : rows.find((row) => row.rowId === rowId)?.tonsPerTour ?? "",
      tourCount:
        vehicle && vehicle.asphaltPayloadTons > 0
          ? String(Math.max(1, Math.ceil(remainingBefore / vehicle.asphaltPayloadTons)))
          : rows.find((row) => row.rowId === rowId)?.tourCount ?? "1",
    });
  }

  function addNextSuggestion() {
    if (!nextSuggestedRow) {
      setRows((currentRows) => [
        ...currentRows,
        createEmptyRow(
          currentRows.length === 0
            ? 0
            : Math.max(...currentRows.map((row) => row.rowId)) + 1,
        ),
      ]);
      return;
    }

    setRows((currentRows) => [...currentRows, nextSuggestedRow]);
  }

  if (position.isFullyAllocated || position.openTons <= 0) {
    return null;
  }

  return (
    <div className="mt-3 w-full max-w-[620px] rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-blue-900">
            Vorschlagsplanung
          </div>
          <div className="mt-1 text-[11px] leading-4 text-blue-900">
            Bei Restmenge wird automatisch ein weiterer Vorschlag ergänzt. Alle
            Zeilen bleiben vor dem Speichern änderbar.
          </div>
        </div>

        <div className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-950">
          Rest: {formatTons(remainingAfterRows)} t
        </div>
      </div>

      <form action={createAsphaltLoadAllocationBatch} className="mt-3 space-y-3">
        <input type="hidden" name="workDate" value={workDate} />
        <input type="hidden" name="sourceType" value="SHORT" />
        <input
          type="hidden"
          name="asphaltDispatchEntryId"
          value={position.asphaltDispatchEntryId}
        />

        <div className="space-y-3">
          {rowsWithCalculations.map(({ row, calculation }, index) => {
            const selectedDriver = drivers.find((driver) => driver.id === row.driverId);
            const selectedVehicle = vehicles.find((vehicle) => vehicle.id === row.vehicleId);
            const duplicateDriverIds = new Set(
              rows
                .filter((otherRow) => otherRow.rowId !== row.rowId)
                .map((otherRow) => otherRow.driverId)
                .filter(Boolean),
            );
            const duplicateVehicleIds = new Set(
              rows
                .filter((otherRow) => otherRow.rowId !== row.rowId)
                .map((otherRow) => otherRow.vehicleId)
                .filter(Boolean),
            );

            return (
              <div
                key={row.rowId}
                className="rounded-xl border border-blue-200 bg-white p-3"
              >
                <input type="hidden" name={`batchRowId_${index}`} value={row.rowId} />
                <input type="hidden" name={`batchDriverId_${index}`} value={row.driverId} />
                <input type="hidden" name={`batchVehicleId_${index}`} value={row.vehicleId} />
                <input type="hidden" name={`batchTourCount_${index}`} value={row.tourCount} />
                <input type="hidden" name={`batchTonsPerTour_${index}`} value={row.tonsPerTour} />
                <input type="hidden" name={`batchStartTime_${index}`} value={row.startTime} />
                <input type="hidden" name={`batchEndTime_${index}`} value={row.endTime} />

                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-blue-950">
                    Vorschlag {index + 1}
                  </div>

                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRow(row.rowId)}
                      title="Vorschlag entfernen"
                      aria-label="Vorschlag entfernen"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-sm font-bold text-red-700 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <label className="text-xs font-medium text-blue-950">
                    Fahrer
                    <select
                      value={row.driverId}
                      onChange={(event) => handleDriverChange(row.rowId, event.target.value)}
                      className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
                    >
                      <option value="">Fahrer wählen</option>
                      {drivers.map((driver) => {
                        const conflict = driverConflicts[driver.id];
                        const duplicateConflict = duplicateDriverIds.has(driver.id);
                        const primaryVehicle = getPrimaryVehicle(driver);
                        const primaryVehicleConflict = primaryVehicle
                          ? vehicleConflicts[primaryVehicle.id]
                          : undefined;

                        return (
                          <option
                            key={driver.id}
                            value={driver.id}
                            disabled={Boolean(
                              conflict || duplicateConflict || primaryVehicleConflict,
                            )}
                          >
                            {conflict || duplicateConflict || primaryVehicleConflict ? "! " : ""}
                            {driver.lastName}, {driver.firstName}
                            {primaryVehicle
                              ? ` · ${getVehicleLabel(primaryVehicle)}`
                              : " · kein Hauptfahrzeug"}
                            {conflict ? ` · bereits ${conflict}` : ""}
                            {primaryVehicleConflict
                              ? ` · Hauptfahrzeug bereits ${primaryVehicleConflict}`
                              : ""}
                            {duplicateConflict ? " · bereits in Vorschlägen" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="text-xs font-medium text-blue-950">
                    Fahrzeug
                    <select
                      value={row.vehicleId}
                      onChange={(event) => handleVehicleChange(row.rowId, event.target.value)}
                      className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
                    >
                      <option value="">Inventarobjekt wählen</option>
                      {vehicles.map((vehicle) => {
                        const conflict = vehicleConflicts[vehicle.id];
                        const duplicateConflict = duplicateVehicleIds.has(vehicle.id);

                        return (
                          <option
                            key={vehicle.id}
                            value={vehicle.id}
                            disabled={Boolean(conflict || duplicateConflict)}
                          >
                            {conflict || duplicateConflict ? "! " : ""}
                            {getVehicleLabel(vehicle)}
                            {vehicle.asphaltPayloadTons > 0
                              ? ` · ${formatTons(vehicle.asphaltPayloadTons)} t`
                              : " · keine Nutzlast"}
                            {conflict ? ` · bereits ${conflict}` : ""}
                            {duplicateConflict ? " · bereits in Vorschlägen" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-blue-950">
                      Touren
                      <input
                        type="number"
                        min="1"
                        value={row.tourCount}
                        onChange={(event) =>
                          updateRow(row.rowId, { tourCount: event.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
                      />
                    </label>

                    <label className="text-xs font-medium text-blue-950">
                      t / Tour
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.tonsPerTour}
                        onChange={(event) =>
                          updateRow(row.rowId, { tonsPerTour: event.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-blue-950">
                      Beginn
                      <input
                        type="time"
                        value={row.startTime}
                        onChange={(event) =>
                          updateRow(row.rowId, { startTime: event.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
                      />
                    </label>

                    <label className="text-xs font-medium text-blue-950">
                      Ende
                      <input
                        type="time"
                        value={row.endTime}
                        onChange={(event) =>
                          updateRow(row.rowId, { endTime: event.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg bg-blue-50 p-2">
                      <div className="text-blue-700">Offen davor</div>
                      <div className="mt-1 font-bold text-blue-950">
                        {formatTons(calculation.remainingBefore)} t
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2">
                      <div className="text-blue-700">Kapazität</div>
                      <div className="mt-1 font-bold text-blue-950">
                        {formatTons(calculation.capacityTons)} t
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2">
                      <div className="text-blue-700">Zuteilung</div>
                      <div className="mt-1 font-bold text-blue-950">
                        {formatTons(calculation.allocatedTons)} t
                      </div>
                    </div>
                    <div className="rounded-lg bg-orange-50 p-2">
                      <div className="text-orange-700">Rest danach</div>
                      <div className="mt-1 font-bold text-orange-950">
                        {formatTons(calculation.remainingAfter)} t
                      </div>
                    </div>
                  </div>

                  {calculation.overCapacityTons > 0 ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs font-medium text-blue-900">
                      Letzte Ladung rechnerisch nicht voll. Restkapazität: {" "}
                      <strong>{formatTons(calculation.overCapacityTons)} t</strong>.
                    </div>
                  ) : null}

                  {selectedDriver && selectedVehicle ? (
                    <div className="rounded-lg bg-gray-50 p-2 text-[11px] leading-4 text-gray-600">
                      Übernahme für <strong>{getDriverLabel(selectedDriver)}</strong> mit {" "}
                      <strong>{getVehicleLabel(selectedVehicle)}</strong>.
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {remainingAfterRows > 0 ? (
          <button
            type="button"
            onClick={addNextSuggestion}
            className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-950 hover:bg-blue-100"
          >
            + weiterer Vorschlag für Restmenge
          </button>
        ) : null}

        {!nextSuggestedRow && remainingAfterRows > 0 ? (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-medium text-yellow-900">
            Für die Restmenge wurde kein weiterer freier LKW mit Nutzlast und
            freiem zugeordneten Fahrer gefunden. Du kannst manuell eine weitere Zeile
            ergänzen oder Inventar/Zuordnung prüfen.
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            rows.length === 0 ||
            rows.some((row) => !row.driverId || !row.vehicleId || getRowCalculation({ row, remainingBefore: position.openTons }).capacityTons <= 0)
          }
          className="w-full rounded-lg bg-blue-900 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-500"
        >
          Vorschläge übernehmen
        </button>
      </form>
    </div>
  );
}
