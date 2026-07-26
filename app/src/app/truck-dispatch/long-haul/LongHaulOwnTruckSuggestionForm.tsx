"use client";

import { useMemo, useState } from "react";
import { createOwnTruckAssignment } from "./actions";

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

type BusyMap = Record<string, string>;

type Suggestion = {
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleLabel: string;
  payloadTons: number;
  tourCount: number;
  capacityTons: number;
  allocatedTons: number;
  overCapacityTons: number;
};

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

function getVehicleLabel(vehicle: VehicleWithDriver | undefined) {
  if (!vehicle) return "";

  return `${vehicle.vehicleNumber} · ${vehicle.licensePlate ?? "-"} · ${
    vehicle.category
  } · ${vehicle.vehicleType}`;
}

function getPrimaryVehicle(driver: DriverWithVehicles | undefined) {
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
  vehicle: VehicleWithDriver;
  drivers: DriverWithVehicles[];
}) {
  const directAssignedDriver = vehicle.driverAssignments[0]?.driver;

  if (directAssignedDriver?.id) {
    return drivers.find((driver) => driver.id === directAssignedDriver.id) ?? null;
  }

  return (
    drivers.find((driver) => getPrimaryVehicle(driver)?.id === vehicle.id) ??
    null
  );
}

function buildBestSuggestion({
  openTons,
  drivers,
  vehicles,
  busyDrivers,
  busyVehicles,
  shortDriverConflicts,
  shortVehicleConflicts,
}: {
  openTons: number;
  drivers: DriverWithVehicles[];
  vehicles: VehicleWithDriver[];
  busyDrivers: BusyMap;
  busyVehicles: BusyMap;
  shortDriverConflicts: BusyMap;
  shortVehicleConflicts: BusyMap;
}) {
  if (openTons <= 0) return null;

  const suggestions = vehicles
    .filter((vehicle) => vehicle.asphaltPayloadTons > 0)
    .filter((vehicle) => !busyVehicles[vehicle.id])
    .filter((vehicle) => !shortVehicleConflicts[vehicle.id])
    .map((vehicle) => {
      const assignedDriver = getAssignedDriverForVehicle({ vehicle, drivers });

      if (!assignedDriver) return null;

      if (
        busyDrivers[assignedDriver.id] ||
        shortDriverConflicts[assignedDriver.id]
      ) {
        return null;
      }

      const payloadTons = roundTons(vehicle.asphaltPayloadTons);
      const tourCount = Math.max(1, Math.ceil(openTons / payloadTons));
      const capacityTons = roundTons(tourCount * payloadTons);
      const allocatedTons = roundTons(Math.min(openTons, capacityTons));
      const overCapacityTons = roundTons(Math.max(0, capacityTons - openTons));

      return {
        driverId: assignedDriver.id,
        driverName: `${assignedDriver.lastName}, ${assignedDriver.firstName}`,
        vehicleId: vehicle.id,
        vehicleLabel: getVehicleLabel(vehicle),
        payloadTons,
        tourCount,
        capacityTons,
        allocatedTons,
        overCapacityTons,
      } satisfies Suggestion;
    })
    .filter((suggestion): suggestion is Suggestion => suggestion !== null)
    .sort((a, b) => {
      if (a.tourCount !== b.tourCount) return a.tourCount - b.tourCount;
      if (a.overCapacityTons !== b.overCapacityTons) {
        return a.overCapacityTons - b.overCapacityTons;
      }
      if (a.payloadTons !== b.payloadTons) return b.payloadTons - a.payloadTons;
      return a.vehicleLabel.localeCompare(b.vehicleLabel, "de-DE");
    });

  return suggestions[0] ?? null;
}

export function LongHaulOwnTruckSuggestionForm({
  entryId,
  openTons,
  drivers,
  vehicles,
  busyDrivers = {},
  busyVehicles = {},
  shortDriverConflicts = {},
  shortVehicleConflicts = {},
}: {
  entryId: string;
  openTons: number;
  drivers: DriverWithVehicles[];
  vehicles: VehicleWithDriver[];
  busyDrivers?: BusyMap;
  busyVehicles?: BusyMap;
  shortDriverConflicts?: BusyMap;
  shortVehicleConflicts?: BusyMap;
}) {
  const initialSuggestion = useMemo(
    () =>
      buildBestSuggestion({
        openTons,
        drivers,
        vehicles,
        busyDrivers,
        busyVehicles,
        shortDriverConflicts,
        shortVehicleConflicts,
      }),
    [
      openTons,
      drivers,
      vehicles,
      busyDrivers,
      busyVehicles,
      shortDriverConflicts,
      shortVehicleConflicts,
    ],
  );

  const [driverId, setDriverId] = useState(initialSuggestion?.driverId ?? "");
  const [vehicleId, setVehicleId] = useState(initialSuggestion?.vehicleId ?? "");
  const [tourCount, setTourCount] = useState(
    initialSuggestion?.tourCount ? String(initialSuggestion.tourCount) : "1",
  );
  const [tonsPerTour, setTonsPerTour] = useState(
    initialSuggestion?.payloadTons ? String(initialSuggestion.payloadTons) : "",
  );
  const [startTime, setStartTime] = useState("06:30");
  const [endTime, setEndTime] = useState("17:00");
  const [notes, setNotes] = useState("");

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const selectedDriver = drivers.find((driver) => driver.id === driverId);

  const parsedTourCount = Math.max(1, Number.parseInt(tourCount || "1", 10) || 1);
  const parsedTonsPerTour = Math.max(0, parseNumber(tonsPerTour));
  const capacityTons = roundTons(parsedTourCount * parsedTonsPerTour);
  const allocatedTons = roundTons(Math.min(openTons, capacityTons));
  const remainingTonsAfterSave = roundTons(Math.max(0, openTons - allocatedTons));
  const overCapacityTons = roundTons(Math.max(0, capacityTons - openTons));

  function handleDriverChange(nextDriverId: string) {
    setDriverId(nextDriverId);

    const driver = drivers.find((item) => item.id === nextDriverId);
    const primaryVehicle = getPrimaryVehicle(driver);
    const vehicle = primaryVehicle
      ? vehicles.find((item) => item.id === primaryVehicle.id)
      : undefined;

    if (
      vehicle &&
      vehicle.asphaltPayloadTons > 0 &&
      !busyVehicles[vehicle.id] &&
      !shortVehicleConflicts[vehicle.id]
    ) {
      setVehicleId(vehicle.id);
      setTonsPerTour(String(vehicle.asphaltPayloadTons));
      setTourCount(String(Math.max(1, Math.ceil(openTons / vehicle.asphaltPayloadTons))));
    }
  }

  function handleVehicleChange(nextVehicleId: string) {
    setVehicleId(nextVehicleId);

    const vehicle = vehicles.find((item) => item.id === nextVehicleId);
    if (!vehicle) return;

    const assignedDriver = getAssignedDriverForVehicle({ vehicle, drivers });
    if (
      assignedDriver &&
      !busyDrivers[assignedDriver.id] &&
      !shortDriverConflicts[assignedDriver.id]
    ) {
      setDriverId(assignedDriver.id);
    }

    if (vehicle.asphaltPayloadTons > 0) {
      setTonsPerTour(String(vehicle.asphaltPayloadTons));
      setTourCount(String(Math.max(1, Math.ceil(openTons / vehicle.asphaltPayloadTons))));
    }
  }

  if (openTons <= 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-blue-900">
        Nächster Vorschlag Langstrecke
      </div>

      <div className="mt-1 text-[11px] leading-4 text-blue-900">
        Dieser Vorschlag erscheint erst nach dem Speichern der vorherigen
        Einteilung. Fahrer, Fahrzeug, Touren und t/Tour kannst du vor dem
        Speichern ändern.
      </div>

      {!initialSuggestion ? (
        <div className="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-medium text-yellow-900">
          Kein freier STIX-LKW mit hinterlegter Nutzlast und freiem Stammfahrer
          gefunden. Du kannst unten trotzdem manuell einteilen.
        </div>
      ) : null}

      <form action={createOwnTruckAssignment} className="mt-3 space-y-2">
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="driverId" value={driverId} />
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <input type="hidden" name="ownTourCount_0" value={tourCount} />
        <input type="hidden" name="ownTonsPerTour_0" value={tonsPerTour} />
        <input type="hidden" name="ownStartTime_0" value={startTime} />
        <input type="hidden" name="ownEndTime_0" value={endTime} />
        <input
          type="hidden"
          name="ownAsphaltNotes_0"
          value={`Vorschlag · Kapazität ${formatTons(capacityTons)} t · Zuteilung ${formatTons(allocatedTons)} t`}
        />
        <input type="hidden" name="notes" value={notes} />

        <label className="block text-xs font-medium text-blue-950">
          Fahrer
          <select
            value={driverId}
            onChange={(event) => handleDriverChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
          >
            <option value="">Fahrer wählen</option>
            {drivers.map((driver) => {
              const conflict = busyDrivers[driver.id] ?? shortDriverConflicts[driver.id];
              const primaryVehicle = getPrimaryVehicle(driver);
              const primaryVehicleConflict = primaryVehicle
                ? busyVehicles[primaryVehicle.id] ?? shortVehicleConflicts[primaryVehicle.id]
                : undefined;

              return (
                <option
                  key={driver.id}
                  value={driver.id}
                  disabled={Boolean(conflict || primaryVehicleConflict)}
                >
                  {conflict || primaryVehicleConflict ? "! " : ""}
                  {driver.lastName}, {driver.firstName}
                  {primaryVehicle
                    ? ` · ${primaryVehicle.licensePlate ?? "-"} · ${primaryVehicle.category}`
                    : " · kein Stammfahrzeug"}
                  {conflict ? ` · bereits ${conflict}` : ""}
                  {!conflict && primaryVehicleConflict
                    ? ` · Stammfahrzeug bereits ${primaryVehicleConflict}`
                    : ""}
                </option>
              );
            })}
          </select>
        </label>

        <label className="block text-xs font-medium text-blue-950">
          Fahrzeug
          <select
            value={vehicleId}
            onChange={(event) => handleVehicleChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
          >
            <option value="">Inventarobjekt wählen</option>
            {vehicles.map((vehicle) => {
              const conflict = busyVehicles[vehicle.id] ?? shortVehicleConflicts[vehicle.id];

              return (
                <option key={vehicle.id} value={vehicle.id} disabled={Boolean(conflict)}>
                  {conflict ? `! bereits ${conflict} · ` : ""}
                  {getVehicleLabel(vehicle)}
                  {vehicle.asphaltPayloadTons > 0
                    ? ` · Nutzlast ${formatTons(vehicle.asphaltPayloadTons)} t`
                    : " · keine Nutzlast"}
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
              value={tourCount}
              onChange={(event) => setTourCount(event.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
            />
          </label>

          <label className="text-xs font-medium text-blue-950">
            t / Tour
            <input
              type="number"
              min="0"
              step="0.01"
              value={tonsPerTour}
              onChange={(event) => setTonsPerTour(event.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-blue-950">
            Beginn
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
            />
          </label>

          <label className="text-xs font-medium text-blue-950">
            Ende
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-white p-2">
            <div className="text-gray-500">Offen</div>
            <div className="mt-1 font-bold text-gray-900">{formatTons(openTons)} t</div>
          </div>
          <div className="rounded-lg bg-white p-2">
            <div className="text-gray-500">Kapazität</div>
            <div className="mt-1 font-bold text-gray-900">{formatTons(capacityTons)} t</div>
          </div>
          <div className="rounded-lg bg-white p-2">
            <div className="text-gray-500">Zuteilung</div>
            <div className="mt-1 font-bold text-blue-950">{formatTons(allocatedTons)} t</div>
          </div>
          <div className="rounded-lg bg-white p-2">
            <div className="text-gray-500">Rest danach</div>
            <div className="mt-1 font-bold text-orange-900">{formatTons(remainingTonsAfterSave)} t</div>
          </div>
        </div>

        {overCapacityTons > 0 ? (
          <div className="rounded-lg border border-blue-200 bg-white p-2 text-xs font-medium text-blue-900">
            Letzte Ladung rechnerisch nicht voll. Restkapazität: <strong>{formatTons(overCapacityTons)} t</strong>.
          </div>
        ) : null}

        {selectedDriver && selectedVehicle ? (
          <div className="rounded-lg bg-white p-2 text-[11px] leading-4 text-gray-600">
            Übernahme für <strong>{selectedDriver.lastName}, {selectedDriver.firstName}</strong> mit <strong>{getVehicleLabel(selectedVehicle)}</strong>.
          </div>
        ) : null}

        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Bemerkung LKW optional"
          className="w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-xs text-gray-900"
        />

        <button
          type="submit"
          disabled={!driverId || !vehicleId || capacityTons <= 0}
          className="w-full rounded-lg bg-blue-900 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-500"
        >
          Vorschlag als LKW-STIX hinzufügen
        </button>
      </form>
    </div>
  );
}
