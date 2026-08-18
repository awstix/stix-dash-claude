"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createAsphaltLoadAllocation } from "../asphalt-load-actions";

type VehicleOption = {
  id: string;
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  asphaltPayloadTons: number;
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

type WorkTimeSettings = {
  name: string;
  startTime: string;
  endTime: string;
};

type ConflictMap = Record<string, string>;

const fallbackWorkTime: WorkTimeSettings = {
  name: "Standard",
  startTime: "06:30",
  endTime: "17:00",
};

function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
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

function getPrimaryVehicle(driver: DriverOption | undefined) {
  if (!driver) return undefined;

  return (
    driver.vehicleAssignments.find((assignment) => assignment.isPrimary)
      ?.vehicle ?? driver.vehicleAssignments[0]?.vehicle
  );
}

export function AsphaltShortAllocationForm({
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
  driverConflicts?: ConflictMap;
  vehicleConflicts?: ConflictMap;
}) {
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [tourCount, setTourCount] = useState(1);
  const [tonsPerTour, setTonsPerTour] = useState("");
  const [tonsPerTourWasEdited, setTonsPerTourWasEdited] = useState(false);
  const [notes, setNotes] = useState("");
  const [workTime, setWorkTime] = useState<WorkTimeSettings>(fallbackWorkTime);
  const [startTime, setStartTime] = useState(fallbackWorkTime.startTime);
  const [endTime, setEndTime] = useState(fallbackWorkTime.endTime);
  const [fullWorkDay, setFullWorkDay] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadWorkTime() {
      try {
        const response = await fetch("/api/work-time", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as WorkTimeSettings;

        if (isMounted && data.startTime && data.endTime) {
          setWorkTime(data);
          setStartTime(data.startTime);
          setEndTime(data.endTime);
        }
      } catch {
        // Fallback bleibt aktiv.
      }
    }

    loadWorkTime();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedDriver = drivers.find((driver) => driver.id === driverId);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);

  const selectedDriverConflict = selectedDriver
    ? driverConflicts[selectedDriver.id]
    : null;

  const selectedVehicleConflict = selectedVehicle
    ? vehicleConflicts[selectedVehicle.id]
    : null;

  // tonsPerTour comes from the native type="number" input below, which
  // per the HTML spec always serializes with a period decimal separator
  // regardless of browser/OS locale - stripping periods here (as a
  // German thousands-separator would need) instead corrupted values
  // like "16.8" into "168".
  const calculatedTotal = useMemo(() => {
    const tons = Number(tonsPerTour);

    if (Number.isNaN(tons)) return 0;

    return Math.round(tourCount * tons * 100) / 100;
  }, [tourCount, tonsPerTour]);

  const payloadWarning =
    selectedVehicle &&
    selectedVehicle.asphaltPayloadTons > 0 &&
    Number(tonsPerTour) > selectedVehicle.asphaltPayloadTons;

  // Informational, not a hard block: real truck loads rarely divide
  // evenly into the open quantity, and the dispatcher may want the
  // overage on purpose (e.g. rounding up to a full last tour) - they
  // still need to be able to order exactly what's actually needed.
  const openOverageTons = roundTons(calculatedTotal - position.openTons);
  const openWarning = openOverageTons > 0;
  const exactTonsPerTour =
    tourCount > 0 ? roundTons(position.openTons / tourCount) : position.openTons;
  const hasConflict = Boolean(selectedDriverConflict || selectedVehicleConflict);

  function resetForm() {
    setDriverId("");
    setVehicleId("");
    setTourCount(1);
    setTonsPerTour("");
    setTonsPerTourWasEdited(false);
    setNotes("");
    setFullWorkDay(true);
    setStartTime(workTime.startTime);
    setEndTime(workTime.endTime);
    setErrorText("");
  }

  function applyVehiclePayload(vehicle: VehicleOption | undefined) {
    if (!vehicle || tonsPerTourWasEdited) return;

    if (vehicle.asphaltPayloadTons > 0) {
      setTonsPerTour(String(vehicle.asphaltPayloadTons));
    }
  }

  function handleDriverChange(nextDriverId: string) {
    setErrorText("");

    const driver = drivers.find((item) => item.id === nextDriverId);

    if (!driver) {
      setDriverId("");
      setVehicleId("");
      return;
    }

    setDriverId(nextDriverId);

    const primaryVehicle = getPrimaryVehicle(driver);

    if (
      primaryVehicle &&
      !vehicleConflicts[primaryVehicle.id]
    ) {
      setVehicleId(primaryVehicle.id);
      applyVehiclePayload(primaryVehicle);
    } else if (primaryVehicle && vehicleConflicts[primaryVehicle.id]) {
      setVehicleId("");
    }
  }

  function handleVehicleChange(nextVehicleId: string) {
    setVehicleId(nextVehicleId);
    setErrorText("");

    const vehicle = vehicles.find((item) => item.id === nextVehicleId);
    applyVehiclePayload(vehicle);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");

    if (hasConflict) {
      setErrorText(
        "Fahrer oder Fahrzeug ist bereits eingeplant. Bitte eine freie Kombination wählen oder die bestehende Einteilung bearbeiten."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      await createAsphaltLoadAllocation(formData);
      resetForm();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Die Asphaltmenge konnte nicht zugeteilt werden."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const effectiveStartTime = fullWorkDay ? workTime.startTime : startTime;
  const effectiveEndTime = fullWorkDay ? workTime.endTime : endTime;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="workDate" value={workDate} />
      <input type="hidden" name="sourceType" value="SHORT" />
      <input
        type="hidden"
        name="asphaltDispatchEntryId"
        value={position.asphaltDispatchEntryId}
      />
      <input type="hidden" name="startTime" value={effectiveStartTime} />
      <input type="hidden" name="endTime" value={effectiveEndTime} />

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <label className="text-xs font-medium text-gray-700">
          Fahrer
          <select
            name="driverId"
            required
            value={driverId}
            disabled={position.isFullyAllocated || isSubmitting}
            onChange={(event) => handleDriverChange(event.target.value)}
            className={
              selectedDriverConflict
                ? "mt-1 w-full rounded-lg border border-yellow-400 bg-yellow-50 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                : "mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            }
          >
            <option value="" disabled>
              Fahrer wählen
            </option>

            {drivers.map((driver) => {
              const primaryVehicle = getPrimaryVehicle(driver);
              const driverConflict = driverConflicts[driver.id];
              const primaryVehicleConflict = primaryVehicle
                ? vehicleConflicts[primaryVehicle.id]
                : null;

              const conflict = driverConflict ?? primaryVehicleConflict;

              return (
                <option
                  key={driver.id}
                  value={driver.id}
                  disabled={Boolean(conflict)}
                >
                  {conflict ? `⚠ ${conflict} · ` : ""}
                  {driver.lastName}, {driver.firstName}
                  {primaryVehicle
                    ? ` · Hauptfahrzeug ${getVehicleLabel(primaryVehicle)}`
                    : " · kein Hauptfahrzeug"}
                </option>
              );
            })}
          </select>
        </label>

        <label className="text-xs font-medium text-gray-700">
          Fahrzeug
          <select
            name="vehicleId"
            required
            value={vehicleId}
            disabled={position.isFullyAllocated || isSubmitting}
            onChange={(event) => handleVehicleChange(event.target.value)}
            className={
              selectedVehicleConflict
                ? "mt-1 w-full rounded-lg border border-yellow-400 bg-yellow-50 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                : "mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            }
          >
            <option value="" disabled>
              Inventarobjekt wählen
            </option>

            {vehicles.map((vehicle) => {
              const conflict = vehicleConflicts[vehicle.id];

              return (
                <option
                  key={vehicle.id}
                  value={vehicle.id}
                  disabled={Boolean(conflict)}
                >
                  {conflict ? `⚠ ${conflict} · ` : ""}
                  {getVehicleLabel(vehicle)}
                  {vehicle.asphaltPayloadTons > 0
                    ? ` · Nutzlast ${formatTons(vehicle.asphaltPayloadTons)} t`
                    : " · keine Nutzlast hinterlegt"}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {selectedDriverConflict ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-semibold text-yellow-900">
          Fahrer bereits eingeplant: {selectedDriverConflict}
        </div>
      ) : null}

      {selectedVehicleConflict ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-semibold text-yellow-900">
          Fahrzeug bereits eingeplant: {selectedVehicleConflict}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
        <label className="text-xs font-medium text-gray-700">
          Touren
          <input
            name="tourCount"
            type="number"
            min="1"
            value={tourCount}
            disabled={position.isFullyAllocated || isSubmitting}
            onChange={(event) =>
              setTourCount(Math.max(1, Number(event.target.value)))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </label>

        <label className="text-xs font-medium text-gray-700">
          t / Tour
          <input
            name="tonsPerTour"
            type="number"
            min="0"
            step="0.01"
            value={tonsPerTour}
            disabled={position.isFullyAllocated || isSubmitting}
            onChange={(event) => {
              setTonsPerTourWasEdited(true);
              setTonsPerTour(event.target.value);
            }}
            placeholder={
              selectedVehicle?.asphaltPayloadTons
                ? String(selectedVehicle.asphaltPayloadTons)
                : "z.B. 18"
            }
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </label>

        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          <div className="font-medium text-gray-500">Gesamt</div>
          <div className="mt-1 font-bold text-gray-900">
            {formatTons(calculatedTotal)} t
          </div>
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs font-medium text-gray-700">
        <input
          type="checkbox"
          checked={fullWorkDay}
          disabled={position.isFullyAllocated || isSubmitting}
          onChange={(event) => {
            setFullWorkDay(event.target.checked);

            if (event.target.checked) {
              setStartTime(workTime.startTime);
              setEndTime(workTime.endTime);
            }
          }}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          Vollständigen Arbeitstag anzeigen
          <span className="block text-[11px] font-normal text-gray-500">
            {workTime.startTime} – {workTime.endTime} · Vorlage: {workTime.name}
          </span>
        </span>
      </label>

      {!fullWorkDay ? (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          <label className="text-xs font-medium text-gray-700">
            Beginn
            <input
              type="time"
              value={startTime}
              disabled={position.isFullyAllocated || isSubmitting}
              onChange={(event) => setStartTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>

          <label className="text-xs font-medium text-gray-700">
            Ende
            <input
              type="time"
              value={endTime}
              disabled={position.isFullyAllocated || isSubmitting}
              onChange={(event) => setEndTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>
        </div>
      ) : null}

      {selectedVehicle ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
          Nutzlast laut Inventar:{" "}
          <strong>
            {selectedVehicle.asphaltPayloadTons > 0
              ? `${formatTons(selectedVehicle.asphaltPayloadTons)} t`
              : "nicht hinterlegt"}
          </strong>
          . Die Handeingabe bei <strong>t / Tour</strong> hat Vorrang.
        </div>
      ) : null}

      {payloadWarning ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-medium text-yellow-900">
          Hinweis: Die Handeingabe liegt über der hinterlegten Fahrzeug-Nutzlast.
          Speichern bleibt möglich.
        </div>
      ) : null}

      {openWarning ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs font-medium text-amber-900">
          <p>
            Die Gesamtmenge liegt {formatTons(openOverageTons)} t über der
            offenen Menge ({formatTons(position.openTons)} t). Das ist okay,
            falls z. B. die letzte Tour bewusst voll beladen werden soll -
            wird die exakte Menge gebraucht, würde{" "}
            {tourCount === 1 ? "diese eine Tour" : "jede der Touren"} nur{" "}
            {formatTons(exactTonsPerTour)} t statt {tonsPerTour || 0} t
            brauchen.
          </p>
          <button
            type="button"
            onClick={() => {
              setTonsPerTour(String(exactTonsPerTour));
              setTonsPerTourWasEdited(true);
            }}
            className="mt-2 rounded-lg border border-amber-400 bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Genau auf {formatTons(position.openTons)} t auffüllen (
            {formatTons(exactTonsPerTour)} t/Tour)
          </button>
        </div>
      ) : null}

      {errorText ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-900">
          {errorText}
        </div>
      ) : null}

      <input
        name="notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Bemerkung optional"
        disabled={position.isFullyAllocated || isSubmitting}
        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
      />

      <button
        type="submit"
        disabled={
          position.isFullyAllocated ||
          isSubmitting ||
          !driverId ||
          !vehicleId ||
          !tonsPerTour ||
          calculatedTotal <= 0 ||
          hasConflict
        }
        className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isSubmitting ? "Wird gespeichert..." : "Menge zuteilen"}
      </button>
    </form>
  );
}
